import { Entity, EntityFactory } from '@openland/foundationdb-entity';
import { Store } from './FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import { directoryReader } from '../openland-module-workers/directoryReader';

type DeletableEntity = Entity<any> & { delete(ctx: Context): void };
const log = createLogger('entity-cleaner');

export function createEntityCleaner<T extends DeletableEntity>(name: string, version: number, entity: EntityFactory<any, any>, batchSize: number, condition: (val: T) => boolean, handleDecoded?: (ctx: Context, val: T[]) => Promise<void>) {
    directoryReader('entities_cleaner' + name, version, entity.descriptor.subspace, batchSize, async (data, first, root) => {
        let existing = await inTx(root, async (ctx) => await Store.EntityCleanerState.findById(ctx, name));

        await inTx(root, async ctx => {
            let deletedDelta = 0;
            let res: T[] = [];

            // wtf imported TupleItem is not assignable
            let brokenRecords: typeof data = [];
            for (let record of data) {
                try {
                    let decoded = (entity as any)._decode(ctx, record.value);
                    let val = (entity as any)._createEntityInstance(ctx, decoded);
                    res.push(val);
                } catch (e) {
                    brokenRecords.push(record);
                }
            }

            if (res.length === 0 || brokenRecords.length === 0) {
                return;
            }

            try {
                if (handleDecoded) {
                    await handleDecoded(ctx, res);
                }
            } catch {
                log.warn(ctx, `Entity cleaner (${name}): handler failed`);
            }
            for (let item of res) {
                if (condition(item)) {
                    await item.delete(ctx);
                    deletedDelta++;
                }
            }

            for (let record of brokenRecords) {
                await entity.descriptor.subspace.clear(ctx, record.key);
                let value = record.value;
                for (let index of entity.descriptor.secondaryIndexes) {
                    let indexKey = [...index.type.fields.map(a => value[a.name]), ...record.key];
                    if (indexKey.every(a => a !== undefined)) {
                        try {
                            await index.subspace.clear(ctx, indexKey);
                            log.warn(ctx, `Broken entity cleared from ${index.name}`);
                        } catch (e) {
                            log.warn(ctx, `Broken entity index '${index.name}' key - ${JSON.stringify(indexKey)}`);
                        }
                    }
                }
                deletedDelta++;
            }

            let latest = await Store.EntityCleanerState.findById(ctx, name);
            if (existing && latest) {
                if (existing.metadata.versionCode === latest.metadata.versionCode) {
                    latest.version = version;

                    if (!latest.brokenRecordsCount) {
                        latest.brokenRecordsCount = 0;
                    }

                    if (first) {
                        latest.deletedCount = deletedDelta;
                        latest.brokenRecordsCount = 0;
                    } else {
                        latest.deletedCount += deletedDelta;
                        latest.brokenRecordsCount += 0;
                    }
                }
            } else if (!latest) {
                await Store.EntityCleanerState.create(ctx, name, { version: version, deletedCount: deletedDelta, brokenRecordsCount: 0 });
            }
        });
    });
}