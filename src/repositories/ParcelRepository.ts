import { DB } from '../tables/index';
import { Normalizer } from '../utils/Normalizer';
import { normalizedProcessor } from '../utils/db_utils';
import { buildGeometryFromInput } from '../modules/geometry';
import { ExtrasInput } from '../api/Core';
import { buildExtrasFromInput } from '../modules/extras';
export class ParcelRepository {

    private normalizer = new Normalizer();

    async fetchParcel(parcelId: number) {
        return await DB.Lot.findById(parcelId);
    }

    async applyParcels(cityId: number, parcel: { id: string, blockId: string, geometry?: number[][][] | null, extras?: ExtrasInput | null; }[]) {

        //
        // Fetching Blocks
        //

        let blocksId = await DB.tx(async (tx) => {
            let blocks = parcel.map((v) => this.normalizer.normalizeId(v.blockId));
            return await normalizedProcessor(blocks, (a, b) => a === b, async (data) => {
                let res = [];
                for (let d of data) {
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
                return res;
            });
        });

        //
        // Applying Lots
        //

        return await DB.tx(async (tx) => {
            let lots = parcel.map((v, index) => ({ blockId: blocksId[index], lotId: this.normalizer.normalizeId(v.id), realId: v.id, geometry: v.geometry, extras: v.extras }));
            return await normalizedProcessor(lots, (a, b) => (a.lotId === b.lotId) && (a.blockId === b.blockId), async (data) => {
                let res = [];
                for (let d of data) {
                    let geometry = d.geometry ? buildGeometryFromInput(d.geometry) : null;
                    let extras = buildExtrasFromInput(d.extras);
                    extras.displayId = d.realId;
                    let existing = await DB.Lot.findOne({
                        where: {
                            blockId: d.blockId,
                            lotId: d.lotId
                        },
                        transaction: tx,
                        lock: tx.LOCK.UPDATE
                    });
                    if (existing) {
                        existing.geometry = geometry;
                        existing.extras = extras;
                        await existing.save({ transaction: tx });
                        res.push(existing.id!!);
                    } else {
                        let id = (await DB.Lot.create({
                            blockId: d.blockId,
                            lotId: d.lotId,
                            geometry: geometry,
                            extras: extras
                        }), { transaction: tx });
                        res.push(id);
                    }
                }
                return res;
            });
        });
    }
}