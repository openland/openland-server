import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { Stream } from '@openland/foundationdb-entity';
import { createLogger } from '@openland/log';

let logger = createLogger('update-reader');
export function updateReader<T>(name: string, version: number, stream: Stream<T>, handler: (args: { items: T[], first: boolean, cursor: string | null }, ctx: Context) => Promise<number | void>, args?: { delay: number }) {
    singletonWorker({ name: 'update_reader_' + name, version, delay: args && args.delay, db: Store.storage.db }, async (root) => {
        let existing = await inTx(root, async (ctx) => await Store.ReaderState.findById(ctx, name));
        let first = false;
        if (existing) {
            if (existing.version === null || existing.version < version) {
                stream.reset();
                first = true;
            } else {
                stream.seek(existing.cursor);
            }
        } else {
            stream.reset();
            first = true;
        }

        let res = await inTx(root, async ctx => await stream.next(ctx));
        if (res.length > 0) {
            // Handling elements
            let estimate = await handler({ items: res, first, cursor: stream.cursor }, root);

            // Commit offset
            await inTx(root, async (ctx) => {
                let latest = await Store.ReaderState.findById(ctx, name);
                if (existing && latest) {
                    // Update if not changed
                    if (existing.metadata.versionCode === latest.metadata.versionCode) {
                        latest.cursor = stream.cursor!;
                        latest.version = version;
                    }
                } else if (!latest) {
                    await Store.ReaderState.create(ctx, name, { cursor: stream.cursor!, version: version });
                }

                if (estimate) {
                    Store.ReaderEstimate.byId(name).set(ctx, estimate);
                    logger.debug(ctx, name + ' estimate: ' + estimate);
                }
            });
        }
    });
}