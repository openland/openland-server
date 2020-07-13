import { Context } from '@openland/context';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { Store } from '../openland-module-db/FDB';
import { inTx, Subspace, TupleItem } from '@openland/foundationdb';
import { cursorToTuple, tupleToCursor } from '@openland/foundationdb-entity/lib/indexes/utils';
import { createLogger } from '@openland/log';

let logger = createLogger('subspace-reader');
export function subspaceReader<T>(name: string, version: number, batchSize: number, subspace: Subspace<TupleItem[], T>, handler: (items: { key: TupleItem[], value: T }[], first: boolean, ctx: Context) => Promise<number |void>, args?: { delay: number }) {
    singletonWorker({ name: name, version, delay: args && args.delay, db: Store.storage.db }, async (root) => {
        let existing = await inTx(root, async (ctx) => await Store.ReaderState.findById(ctx, name));
        let first = false;
        let cursor: TupleItem[] | undefined = undefined;
        if (existing) {
            if (existing.version === null || existing.version < version) {
                first = true;
            } else {
                cursor = cursorToTuple(existing.cursor);
            }
        } else {
            first = true;
        }

        let next = async () => {
            let data = await inTx(root, async ctx => await subspace.range(ctx, [], { after: cursor, limit: batchSize }));
            if (data.length > 0) {
                cursor = data[data.length - 1].key;
            }
            return data;
        };

        let res = await next();
        if (res.length > 0) {

            // Handling elements
            let estimate = await handler(res, first, root);

            // Commit offset
            await inTx(root, async (ctx) => {
                let latest = await Store.ReaderState.findById(ctx, name);
                if (existing && latest) {
                    // Update if not changed
                    if (existing.metadata.versionCode === latest.metadata.versionCode) {
                        latest.cursor = tupleToCursor(cursor!);
                        latest.version = version;
                    }
                } else if (!latest) {
                    await Store.ReaderState.create(ctx, name, { cursor: tupleToCursor(cursor!), version: version });
                }

                if (estimate) {
                    Store.ReaderEstimate.byId(name).set(ctx, estimate);
                    logger.debug(ctx, name + ' estimate: ' + estimate);
                }
            });
        }
    });
}