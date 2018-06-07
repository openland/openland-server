import { DB } from '../tables/index';
import { ExtrasInput } from '../api/types';
import { buildGeometryFromInput } from '../modules/geometry';
import * as Normalizer from '../modules/Normalizer';
import { buildExtrasFromInput } from '../modules/extras';
import { SelectBuilder } from '../modules/SelectBuilder';
import { currentTime } from '../utils/timer';
import { ElasticClient } from '../indexing';
import { fastDeepEquals } from '../utils/fastDeepEquals';

export class BlockRepository {

    async fetchBlock(id: number) {
        return await DB.Block.findById(id);
    }

    async fetchBlocks(cityId: number, first: number, filter?: string, after?: string, page?: number) {
        return await new SelectBuilder(DB.Block)
            .whereEq('cityId', cityId)
            .after(after)
            .page(page)
            .limit(first)
            .findAll();
    }

    async fetchGeoBlocks(box: { south: number, north: number, east: number, west: number }, limit: number, query?: string | null) {
        let start = currentTime();
        let must = { match_all: {} };
        // if (query) {
        //     let parsed = this.parser.parseQuery(query);
        //     let elasticQuery = buildElasticQuery(parsed);
        //     console.warn(elasticQuery);
        //     must = elasticQuery;
        // }

        let hits = await ElasticClient.search({
            index: 'blocks',
            type: 'block',
            size: limit,
            from: 0,
            body: {
                query: {
                    bool: {
                        must: must,
                        filter: {
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
                        }
                    }
                }
            }
        });

        // ElasticClient.scroll({ scrollId: hits._scroll_id!!, scroll: '60000' });

        console.warn('Searched in ' + (currentTime() - start) + ' ms');
        start = currentTime();
        let res = await DB.Block.findAll({
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

    async applyBlocks(cityId: number, blocks: { id: string, displayId?: string[] | null, geometry?: number[][][][] | null, extras?: ExtrasInput | null }[]) {
        await DB.tx(async (tx) => {
            let pending: any[] = [];
            for (let b of blocks) {
                let blockIdNormalized = Normalizer.normalizeId(b.id);
                let geometry = b.geometry ? buildGeometryFromInput(b.geometry) : null;
                let extras = buildExtrasFromInput(b.extras);

                // Searchable ID
                if (b.displayId && b.displayId.length > 0) {
                    extras.searchId = [b.id, ...b.displayId];
                } else {
                    extras.searchId = [b.id];
                }

                // Display ID
                extras.displayId = b.id;

                let existing = await DB.Block.findOne({
                    where: { cityId: cityId, blockId: blockIdNormalized },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });

                // Merged extras
                let completedExtras = extras;
                if (existing && existing.extras) {
                    completedExtras = Object.assign(existing.extras, extras);
                }

                if (existing) {
                    
                    let changed = (geometry !== undefined && !fastDeepEquals(geometry, existing.geometry))
                        || !fastDeepEquals(completedExtras, existing.extras);
                    if (changed) {
                        if (geometry !== undefined) {
                            existing.geometry = geometry;
                        }
                        existing.extras = completedExtras;
                        pending.push(existing.save({ transaction: tx }));
                    }
                } else {
                    pending.push(DB.Block.create({
                        cityId: cityId,
                        blockId: blockIdNormalized,
                        extras: completedExtras,
                        geometry: geometry
                    }, { transaction: tx }));
                }
            }
            for (let p of pending) {
                await p;
            }
        });
    }
}