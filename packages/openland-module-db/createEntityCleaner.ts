import { Entity, EntityFactory } from '@openland/foundationdb-entity';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { Store } from './FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';

type DeletableEntity = Entity<any> & { delete(ctx: Context): void };

export function createEntityCleaner<T extends DeletableEntity>(name: string, version: number, entity: EntityFactory<any, any>, batchSize: number, condition: (val: T) => boolean) {
    singletonWorker({ name: 'entities_cleaner' + name, version, delay: 1000, db: Store.storage.db }, async (root) => {
        let existing = await inTx(root, async (ctx) => await Store.EntityCleanerState.findById(ctx, name));
        let first = false;
        let after: undefined|any[] = undefined;

        if (existing) {
            if (existing.version === null || existing.version < version) {
                after = undefined;
                first = true;
            } else {
                after = existing.lastId;
            }
        } else {
            after = undefined;
            first = true;
        }

        await inTx(root, async ctx => {
            let deletedDelta = 0;
            let brokenDelta = 0;

            // TODO: move this to Entity layer
            let data = await entity.descriptor.subspace.range(ctx, [], {limit: batchSize, after});
            let res: T[] = [];
            for (let record of data) {
                try {
                    let decoded = (entity as any)._decode(ctx, record.value);
                    let val = (entity as any)._createEntityInstance(ctx, decoded);
                    res.push(val);
                } catch (e) {
                    brokenDelta++;
                }
            }

            if (res.length === 0) {
                return;
            }
            after = data[data.length - 1].key;

            for (let item of res) {
                if (condition(item)) {
                    await item.delete(ctx);
                    deletedDelta++;
                }
            }

            let latest = await Store.EntityCleanerState.findById(ctx, name);
            if (existing && latest) {
                if (existing.metadata.versionCode === latest.metadata.versionCode) {
                    latest.lastId = after;
                    latest.version = version;

                    if (!latest.brokenRecordsCount) {
                        latest.brokenRecordsCount = 0;
                    }

                    if (first) {
                        latest.deletedCount = deletedDelta;
                        latest.brokenRecordsCount = brokenDelta;
                    } else {
                        latest.deletedCount += deletedDelta;
                        latest.brokenRecordsCount += brokenDelta;
                    }
                }
            } else if (!latest) {
                await Store.EntityCleanerState.create(ctx, name, { lastId: after, version: version, deletedCount: deletedDelta, brokenRecordsCount: brokenDelta });
            }
        });
    });
}