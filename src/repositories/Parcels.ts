import { DB } from '../tables';
import { normalizedProcessor } from '../utils/db_utils';
import { Geometry } from '../modules/geometry';

function normalizeId(id: string) {
    return id.replace(/^0+/, '');
}

export async function applyBlocks(cityId: number, blocks: { blockId: string, geometry: { la: number, lo: number }[][] }[]) {
    await DB.tx(async (tx) => {
        for (let b of blocks) {
            let existing = await DB.Block.findOne({
                where: {
                    cityId: cityId,
                    blockId: b.blockId
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });
            let geometry: Geometry = {
                polygons: b.geometry.map((v) => ({ coordinates: v.map((c) => ({ latitude: c.la, longitude: c.lo })) }))
            };
            if (existing) {
                existing.geometry = geometry;
                await existing.save({ transaction: tx });
            } else {
                await DB.Block.create({
                    cityId: cityId,
                    blockId: b.blockId,
                    geometry: geometry
                }, { transaction: tx });
            }
        }
    });
}

export async function applyParcels(cityId: number, parcel: { blockId: string, lotId: string, geometry: { la: number, lo: number }[][]; }[]) {
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
        let lots = parcel.map((v, index) => ({ blockId: blocksId[index], lotId: normalizeId(v.lotId), geometry: v.geometry }));
        return await normalizedProcessor(lots, (a, b) => (a.lotId === b.lotId) && (a.blockId === b.blockId), async (data) => {
            let res = [];
            for (let d of data) {
                let geometry: Geometry = {
                    polygons: d.geometry.map((v) => ({ coordinates: v.map((c) => ({ latitude: c.la, longitude: c.lo })) }))
                };
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
                    await existing.save({ transaction: tx });
                    res.push(existing.id!!);
                } else {
                    let id = (await DB.Lot.create({
                        blockId: d.blockId,
                        lotId: d.lotId,
                        geometry: geometry
                    }), { transaction: tx });
                    res.push(id);
                }
            }
            return res;
        });
    });
}