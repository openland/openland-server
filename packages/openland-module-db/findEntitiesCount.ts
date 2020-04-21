import { EntityFactory } from '@openland/foundationdb-entity';
import { createNamedContext } from '@openland/context';
import { getTransaction, inTx } from '@openland/foundationdb';
import { Store } from './FDB';
import { singletonWorker } from '@openland/foundationdb-singleton';

const rootCtx = createNamedContext('entities-count');
const BATCH_SIZE = 1024;

export async function findEntitiesCount(entity: EntityFactory<any, any>) {
    let after: undefined|any[] = undefined;
    let res = 0;

    while (true) {
        let data: { key: any, value: any; }[] = await inTx(rootCtx, async (ctx) => {
            getTransaction(ctx).setOptions({
                causal_read_risky: true,
                read_your_writes_disable: true
            });
            return await entity.descriptor.subspace.snapshotRange(ctx, [], {limit: BATCH_SIZE, after});
        });
        if (data.length === 0) {
            return res;
        }

        res += data.length;
        after = data[data.length - 1].key;
    }
}

export function createEntitiesCounter<T>(name: string, version: number, entity: EntityFactory<any, any>, batchSize: number) {
    singletonWorker({ name: 'entities_counter' + name, version, delay: 100, db: Store.storage.db }, async (root) => {
        let existing = await inTx(root, async (ctx) => await Store.EntityCounterState.findById(ctx, name));
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
            let res = await entity.descriptor.subspace.snapshotRange(ctx, [], {limit: batchSize, after});
            if (res.length === 0) {
                return;
            }
            after = res[res.length - 1].key;

            let latest = await Store.EntityCounterState.findById(ctx, name);
            if (existing && latest) {
                if (existing.metadata.versionCode === latest.metadata.versionCode) {
                    latest.lastId = after;
                    latest.version = version;
                    if (first) {
                        latest.count = res.length;
                    } else {
                        latest.count = latest.count + res.length;
                    }
                }
            } else if (!latest) {
                await Store.EntityCounterState.create(ctx, name, { lastId: after, version: version, count: res.length });
            }
        });
    });
}
