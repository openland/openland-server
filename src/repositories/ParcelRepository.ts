import { DB } from '../tables/index';
import { Normalizer } from '../utils/Normalizer';
import { normalizedProcessor } from '../utils/db_utils';
import { buildGeometryFromInput } from '../modules/geometry';
import { ExtrasInput } from '../api/Core';
import { buildExtrasFromInput } from '../modules/extras';
import { SelectBuilder } from '../utils/SelectBuilder';
import { ElasticClient } from '../indexing';
import { applyStreetNumbers } from './Streets';
export class ParcelRepository {

    private normalizer = new Normalizer();

    async fetchParcel(parcelId: number) {
        return await DB.Lot.findById(parcelId);
    }

    async fetchParcels(cityId: number, first: number, query?: string, after?: string, page?: number) {
        let clauses: any[] = [];
        clauses.push({ term: { 'cityId': cityId } });

        let sort = [{ 'landValue': { 'order': 'desc' } }];

        let hits = await ElasticClient.search({
            index: 'parcels',
            type: 'parcel',
            size: first,
            from: page ? (page * first) : 0,
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

    async applyParcels(cityId: number, parcel: {
        id: string, blockId?: string | null,
        geometry?: number[][][] | null,
        addresses?: {
            streetName: string,
            streetNameSuffix?: string | null
            streetNumber: number,
            streetNumberSuffix?: string | null
        }[],
        extras?: ExtrasInput | null
    }[]) {

        //
        // Fetching Blocks
        //

        let blocks = parcel.map((v) => v.blockId ? this.normalizer.normalizeId(v.blockId) : null);
        let blocksId = await DB.tx(async (tx) => {
            return await normalizedProcessor(blocks, (a, b) => a === b, async (data) => {
                let res = [];
                for (let d of data) {
                    if (!d) {
                        res.push(null);
                    } else {
                        let existing = await DB.Block.findOne({
                            where: {
                                cityId: cityId,
                                blockId: d
                            },
                            transaction: tx
                        });
                        if (existing) {
                            res.push(existing.id!!);
                        } else {
                            let id = (await DB.Block.create({
                                cityId: cityId,
                                blockId: d
                            }, { transaction: tx })).id!!;
                            res.push(id);
                        }
                    }
                }
                return res;
            });
        });

        //
        // Applying Lots
        //

        return await DB.tx(async (tx) => {
            let lots = parcel.map((v, index) => ({ blockId: blocksId[index], lotId: this.normalizer.normalizeId(v.id), realId: v.id, geometry: v.geometry, extras: v.extras, addresses: v.addresses }));
            return await normalizedProcessor(lots, (a, b) => (a.lotId === b.lotId) && (a.blockId === b.blockId), async (data) => {
                let res = [];
                for (let d of data) {
                    let geometry = d.geometry ? buildGeometryFromInput(d.geometry) : null;
                    let extras = buildExtrasFromInput(d.extras);
                    extras.displayId = d.realId;
                    let existing = await DB.Lot.findOne({
                        where: {
                            cityId: cityId,
                            lotId: d.lotId
                        },
                        transaction: tx,
                        lock: tx.LOCK.UPDATE
                    });

                    // Merged extras
                    let completedExtras = extras;
                    if (existing && existing.extras) {
                        completedExtras = Object.assign(existing.extras, extras);
                    }

                    if (existing) {
                        if (geometry !== null) {
                            existing.geometry = geometry;
                        }
                        existing.extras = completedExtras;
                        if (d.blockId) {
                            existing.blockId = d.blockId;
                        }
                        await existing.save({ transaction: tx });
                        res.push(existing.id!!);
                    } else {
                        if (d.blockId) {
                            existing = await DB.Lot.create({
                                blockId: d.blockId,
                                cityId: cityId,
                                lotId: d.lotId,
                                geometry: geometry,
                                extras: completedExtras
                            }, { transaction: tx });
                            res.push(existing.id);
                        } else {
                            res.push(null);
                        }
                    }

                    if (existing && d.addresses) {
                        let ids = await applyStreetNumbers(cityId, d.addresses);
                        console.warn(ids);
                        await existing.setStreetNumbers(ids, { transaction: tx });
                    }
                }
                return res;
            });
        });
    }
}