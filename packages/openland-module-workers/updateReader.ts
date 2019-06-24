import { FEntity } from 'foundation-orm/FEntity';
import { FStream } from 'foundation-orm/FStream';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { singletonWorker } from '@openland/foundationdb-singleton';

export function updateReader<T extends FEntity>(name: string, version: number, stream: FStream<T>, handler: (items: T[], first: boolean, ctx: Context) => Promise<void>, args?: { delay: number }) {
    singletonWorker({ name: 'update_reader_' + name, version, delay: args && args.delay, db: FDB.layer.db }, async (root) => {
        let existing = await inTx(root, async (ctx) => await FDB.ReaderState.findById(ctx, name));
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
            await handler(res, first, root);

            // Commit offset
            await inTx(root, async (ctx) => {
                let latest = await FDB.ReaderState.findById(ctx, name);
                if (existing && latest) {
                    // Update if not changed
                    if (existing.versionCode === latest.versionCode) {
                        latest.cursor = stream.cursor;
                        latest.version = version;
                    }
                } else if (!latest) {
                    await FDB.ReaderState.create(ctx, name, { cursor: stream.cursor, version: version });
                }
            });
        }
    });
} 