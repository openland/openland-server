import { DB, Lot } from '../tables/index';
import * as Normalizer from '../modules/Normalizer';
import { normalizedProcessor } from '../utils/db_utils';
import { buildGeometryFromInput } from '../modules/geometry';
import { ExtrasInput } from '../api/Core';
import { buildExtrasFromInput } from '../modules/extras';
import { SelectBuilder } from '../modules/SelectBuilder';
import { ElasticClient } from '../indexing';
import { applyStreetNumbersInTx } from './Streets';
import { QueryParser, buildElasticQuery } from '../modules/QueryParser';
import { currentTime } from '../utils/timer';
import { fastDeepEquals } from '../utils/fastDeepEquals';

export class ParcelRepository {

    private parser = new QueryParser();

    constructor() {
        this.parser.registerInt('stories', 'stories');
        this.parser.registerInt('area', 'area');
        this.parser.registerText('zone', 'zoning');
        this.parser.registerText('currentUse', 'currentUse');
        this.parser.registerBoolean('onSale', 'available');
        this.parser.registerText('landUse', 'landUse');
        this.parser.registerInt('transitDistance', 'distance');
        this.parser.registerBoolean('isOkForTower', 'isOkForTower');
        this.parser.registerBoolean('isVacant', 'vacant');
        this.parser.registerText('compatibleBuildings', 'compatibleBuildings');
        this.parser.registerBoolean('customerUrbynQuery1', 'customerUrbynQuery1');
        this.parser.registerBoolean('customerUrbynQuery2', 'customerUrbynQuery2');
        this.parser.registerBoolean('customerUrbynQuery3', 'customerUrbynQuery3');
        this.parser.registerBoolean('ownerPublic', 'ownerPublic');
        this.parser.registerBoolean('ownerName', 'ownerName');
    }

    async applyMetadata(id: number, metadata: { description?: string | null, currentUse?: string | null, available?: boolean | null, isOkForTower?: boolean | null }) {
        let lot = await DB.Lot.findById(id);
        if (!lot) {
            throw Error('Unable to find lot');
        }
        let updated = Object.assign({}, lot.metadata);
        if (metadata.description !== undefined) {
            updated.description = Normalizer.normalizeNullableUserInput(metadata.description);
        }
        if (metadata.currentUse !== undefined) {
            updated.currentUse = Normalizer.normalizeNullableUserInput(metadata.currentUse);
        }
        if (metadata.available !== undefined) {
            updated.available = metadata.available;
        }
        if (metadata.isOkForTower !== undefined) {
            updated.isOkForTower = metadata.isOkForTower;
        }
        lot.metadata = updated;
        await lot.save();
        return lot;
    }

    async fetchParcel(parcelId: number) {
        return await DB.Lot.findById(parcelId);
    }

    async fetchFavorites(userId: number) {
        return await DB.Lot.findAll({
            include: [{
                model: DB.User,
                as: 'likes',
                where: {
                    id: userId
                }
            }]
        });
    }

    async fetchFavoritesCount(userId: number) {
        return await DB.Lot.count({
            include: [{
                model: DB.User,
                as: 'likes',
                where: {
                    id: userId
                }
            }]
        });
    }

    async fetchParcelsConnection(cityId: number, first: number, query?: string, after?: string, page?: number) {
        let clauses: any[] = [];
        clauses.push({ term: { 'cityId': cityId } });
        if (query) {
            let parsed = this.parser.parseQuery(query);
            let elasticQuery = buildElasticQuery(parsed);
            clauses.push(elasticQuery);
        }

        let sort = [{ 'landValue': { 'order': 'desc' } }];

        let hits = await ElasticClient.search({
            index: 'parcels',
            type: 'parcel',
            size: first,
            from: page ? ((page - 1) * first) : 0,
            body: {
                query: { bool: { must: clauses } },
                sort: sort
            }
        });

        let builder = new SelectBuilder(DB.Lot)
            .whereEq('cityId', cityId)
            .after(after)
            .page(page)
            .limit(first);
        return await builder.findElastic(hits);
    }

    async fetchAllParcels(cityId: number, query?: string | null) {
        let clauses: any[] = [];
        clauses.push({ term: { 'cityId': cityId } });
        if (query) {
            let parsed = this.parser.parseQuery(query);
            let elasticQuery = buildElasticQuery(parsed);
            clauses.push(elasticQuery);
        }

        let hits = await ElasticClient.search({
            index: 'parcels',
            type: 'parcel',
            size: 1000,
            scroll: '10m',
            body: {
                query: { bool: { must: clauses } },
            }
        });

        let allIds = new Set<number>();
        hits.hits.hits.forEach((v) => allIds.add(parseInt(v._id, 10)));
        while (hits.hits.hits.length > 0) {
            hits = await ElasticClient.scroll({
                scrollId: hits._scroll_id!!,
                scroll: '10m',
            });
            hits.hits.hits.forEach((v) => allIds.add(parseInt(v._id, 10)));
        }

        return [...allIds];
    }

    async fetchUserData(organizationId: number, lotId: number) {
        return (await DB.LotUserData.find({ where: { organizationId: organizationId, lotId: lotId } })) || {};
    }

    async setNotes(organizationId: number, lotId: number, notes: string) {
        return DB.txLight(async (tx) => {
            let lotUserData = await DB.LotUserData.find({
                where: { organizationId: organizationId, lotId: lotId },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });
            let normalized = Normalizer.normalizeNullableUserInput(notes);
            if (lotUserData) {
                lotUserData.notes = normalized;
                await lotUserData.save({ transaction: tx });
                return lotUserData;
            } else {
                return await DB.LotUserData.create({
                    organizationId: organizationId,
                    lotId: lotId,
                    notes: normalized
                }, { transaction: tx });
            }
        });
    }

    async fetchGeoParcels(box: { south: number, north: number, east: number, west: number }, limit: number, query?: string | null) {
        let start = currentTime();
        let must = { match_all: {} };
        if (query) {
            let parsed = this.parser.parseQuery(query);
            let elasticQuery = buildElasticQuery(parsed);
            must = elasticQuery;
        }

        let hits = await ElasticClient.search({
            index: 'parcels',
            type: 'parcel',
            size: limit,
            from: 0,
            body: {
                query: {
                    bool: {
                        must: must,
                        filter: {
                            bool: {
                                must: [
                                    {
                                        geo_shape: {
                                            geometry: {
                                                shape: {
                                                    type: 'envelope',
                                                    coordinates:
                                                        [[box.west, box.south],
                                                        [box.east, box.north]],
                                                }
                                            }
                                        }
                                    },
                                    {
                                        term: { retired: false }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        });

        // ElasticClient.scroll({ scrollId: hits._scroll_id!!, scroll: '60000' });

        console.warn('Searched in ' + (currentTime() - start) + ' ms');
        start = currentTime();
        let res = await DB.Lot.findAll({
            where: {
                id: {
                    $in: hits.hits.hits.map((v) => v._id)
                }
            },
            raw: true
        });
        console.warn('Fetched in ' + (currentTime() - start) + ' ms (' + res.length + ')');
        return res;
    }

    async fetchParcelsCount(query?: string | null, cityId?: number | null) {
        let must: any = { match_all: {} };
        if (cityId !== undefined && cityId !== null) {
            must = {
                'bool': {
                    must: [{ match: { cityId: cityId } }]
                }
            };
        }
        if (query) {
            let parsed = this.parser.parseQuery(query);
            let elasticQuery = buildElasticQuery(parsed);
            if (cityId !== undefined && cityId !== null) {
                must = {
                    'bool': {
                        must: [{ match: { cityId: cityId } }, elasticQuery]
                    }
                };
            } else {
                must = elasticQuery;
            }
        }
        let hits = await ElasticClient.count({
            index: 'parcels',
            type: 'parcel',
            body: {
                query: {
                    bool: {
                        must: must,
                        filter: {
                            term: { retired: false }
                        }
                    }
                }
            }
        });
        return hits.count;
    }

    async applyParcelIds(cityId: number, ids: string[]) {
        let nids = Normalizer.normalizeIds(ids);
        return DB.tx(async (tx) => {
            let existing = await DB.ParcelID.findAll({
                where: {
                    parcelId: {
                        $in: [...nids.unique]
                    },
                    cityId: cityId
                },
                transaction: tx
            });
            let pending = [];
            for (let i of nids.unique) {
                if (!existing.find((v) => v.parcelId === i)) {
                    pending.push({ parcelId: i, cityId: cityId });
                }
            }
            let created = await DB.ParcelID.bulkCreate(pending, { transaction: tx });
            let all = [...created, ...existing];
            let res = new Map<string, number>();
            for (let i of ids) {
                let rid = nids.map.get(i);
                let m = all.find((v) => v.parcelId === rid);
                if (!m) {
                    throw Error('Inconsistentcy detected!');
                }
                res.set(i, m.id!!);
            }
            return res;
        });
    }

    async applyParcels(cityId: number, parcel: {
        id: string,
        displayId?: string[] | null,
        geometry?: number[][][][] | null,
        retired?: boolean,
        addresses?: {
            streetName: string,
            streetNameSuffix?: string | null
            streetNumber: number,
            streetNumberSuffix?: string | null
        }[],
        related?: string[] | null,
        extras?: ExtrasInput | null
    }[]) {

        //
        // Apply IDS
        //
        let sourceIds: string[] = [];
        for (let i of parcel) {
            sourceIds.push(i.id);
            if (i.related) {
                for (let j of i.related) {
                    sourceIds.push(j);
                }
            }
        }

        let parcelIds = await this.applyParcelIds(cityId, parcel.map((v) => v.id));

        //
        // Applying Lots
        //

        return await DB.tx(async (tx) => {
            let lots = parcel.map((v, index) => ({
                lotId: Normalizer.normalizeId(v.id),
                realId: v.id,
                displayId: v.displayId,
                geometry: v.geometry,
                extras: v.extras,
                addresses: v.addresses,
                primaryParcelId: parcelIds.get(v.id),
                retired: v.retired === undefined || v.retired === null ? false : v.retired
            }));
            return await normalizedProcessor(lots, (a, b) => (a.lotId === b.lotId), async (data) => {
                let existingLots = await DB.Lot.findAll({
                    where: {
                        cityId: cityId,
                        lotId: {
                            $in: data.map((v) => v.lotId)
                        }
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });

                let pending: Promise<number>[] = [];

                for (let d of data) {
                    let existing = existingLots.find((v) => v.lotId === d.lotId);

                    let geometry = d.geometry ? buildGeometryFromInput(d.geometry) : null;
                    let extras = buildExtrasFromInput(d.extras);

                    // Searchable and Display ID
                    if (d.displayId && d.displayId.length > 0) {
                        extras.searchId = [...new Set([d.realId, ...d.displayId])];
                        extras.displayId = d.displayId[0];
                    } else {
                        extras.searchId = [d.realId];
                        extras.displayId = d.realId;
                    }

                    // Merged extras
                    let completedExtras = extras;
                    if (existing && existing.extras) {
                        completedExtras = Object.assign({}, existing.extras, extras);
                    }

                    if (existing) {
                        let changed = (geometry !== null && !fastDeepEquals(geometry, existing.geometry))
                            || !fastDeepEquals(completedExtras, existing.extras)
                            || !fastDeepEquals(d.primaryParcelId, existing.primaryParcelId)
                            || d.retired !== existing.retired;
                        if (changed) {
                            if (geometry !== null) {
                                existing.geometry = geometry;
                            }
                            existing.extras = completedExtras;
                            existing.primaryParcelId = d.primaryParcelId;
                            existing.retired = d.retired;
                            let func = async (lot: Lot) => {
                                await lot.save({ transaction: tx });
                                if (d.addresses) {
                                    let ids = await applyStreetNumbersInTx(tx, cityId, d.addresses);
                                    ids = [...new Set(ids)]; // Filter duplicates
                                    await lot.setStreetNumbers(ids, { transaction: tx });
                                }
                                return lot.id!!;
                            };
                            pending.push(func(existing));
                        } else {
                            let func = async (lot: Lot) => {
                                if (d.addresses) {
                                    let ids = await applyStreetNumbersInTx(tx, cityId, d.addresses);
                                    ids = [...new Set(ids)]; // Filter duplicates
                                    await lot.setStreetNumbers(ids, { transaction: tx });
                                }
                                return lot.id!!;
                            };
                            pending.push(func(existing));
                        }
                    } else {
                        let func = async () => {
                            let r = await DB.Lot.create({
                                cityId: cityId,
                                lotId: d.lotId,
                                primaryParcelId: d.primaryParcelId,
                                geometry: geometry,
                                extras: completedExtras,
                                retired: d.retired
                            }, { transaction: tx });
                            if (d.addresses) {
                                let ids = await applyStreetNumbersInTx(tx, cityId, d.addresses);
                                ids = [...new Set(ids)]; // Filter duplicates
                                await r.setStreetNumbers(ids, { transaction: tx });
                            }
                            return r.id!!;
                        };
                        pending.push(func());
                    }
                }

                let res: number[] = [];
                for (let p of pending) {
                    res.push((await p));
                }
                return res;
            });
        });
    }

    async findParcels(cityId: number, rawIds: string[]): Promise<Map<string, Lot>> {
        let normalized = rawIds.map((v) => Normalizer.normalizeId(v));
        let found = await DB.Lot.findAll({
            where: {
                cityId: cityId,
                lotId: {
                    $in: [...new Set(normalized)]
                }
            }
        });
        let res = new Map<string, Lot>();
        for (let i = 0; i < rawIds.length; i++) {
            let existing = found.find((f) => f.lotId === normalized[i]);
            if (existing) {
                res.set(rawIds[i], existing);
            }
        }
        return res;
    }
}