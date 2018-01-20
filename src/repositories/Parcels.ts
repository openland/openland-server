import { DB } from '../tables';
import { normalizedProcessor } from '../utils/db_utils';

function normalizeId(id: string) {
    return id.replace(/^0+/, '');
}

export async function applyParcels(cityId: number, parcel: { blockId: string, lotId: string }[]) {
    let blocksId = await DB.tx(async (tx) => {
        let blocks = parcel.map((v) => normalizeId(v.blockId));
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
    return await DB.tx(async (tx) => {
        let lots = parcel.map((v, index) => ({ blockId: blocksId[index], lotId: normalizeId(v.lotId) }));
        return await normalizedProcessor(lots, (a, b) => (a.lotId === b.lotId) && (a.blockId === b.blockId), async (data) => {
            let res = [];
            for (let d of data) {
                let existing = await DB.Lot.findOne({
                    where: {
                        blockId: d.blockId,
                        lotId: d.lotId
                    },
                    transaction: tx
                });
                if (existing) {
                    res.push(existing.id!!);
                } else {
                    let id = (await DB.Lot.create({
                        blockId: d.blockId,
                        lotId: d.lotId
                    }), { transaction: tx });
                    res.push(id);
                }
            }
            return res;
        });
    });
}