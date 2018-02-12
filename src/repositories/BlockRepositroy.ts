import { DB } from '../tables/index';
import { ExtrasInput } from '../api/Core';
import { buildGeometryFromInput } from '../modules/geometry';
import { Normalizer } from '../utils/Normalizer';
import { buildExtrasFromInput } from '../modules/extras';

export class BlockRepository {

    private normalizer = new Normalizer();

    async applyBlocks(cityId: number, blocks: { id: string, geometry?: number[][][] | null, extras?: ExtrasInput | null }[]) {
        await DB.tx(async (tx) => {
            for (let b of blocks) {
                let blockIdNormalized = this.normalizer.normalizeId(b.id);
                let geometry = b.geometry ? buildGeometryFromInput(b.geometry) : null;
                let extras = buildExtrasFromInput(b.extras);
                extras.displayId = b.id;

                let existing = await DB.Block.findOne({
                    where: { cityId: cityId, blockId: blockIdNormalized },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });

                if (existing) {
                    existing.geometry = geometry;
                    existing.extras = extras;
                    await existing.save({ transaction: tx });
                } else {
                    await DB.Block.create({
                        cityId: cityId,
                        blockId: blockIdNormalized,
                        extras: extras,
                        geometry: geometry
                    }, { transaction: tx });
                }
            }
        });
    }
}