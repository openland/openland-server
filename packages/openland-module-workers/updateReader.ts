import { FEntity } from 'foundation-orm/FEntity';
import { FStream } from 'foundation-orm/FStream';
import { staticWorker } from './staticWorker';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';
import { createEmptyContext } from 'openland-utils/Context';

export function updateReader<T extends FEntity>(name: string, version: number, stream: FStream<T>, handler: (items: T[], first: boolean) => Promise<void>, args?: { delay: number }) {
    staticWorker({ name: 'update_reader_' + name, version, delay: args && args.delay }, async () => {
        let ctx = createEmptyContext();
        let existing = await FDB.ReaderState.findById(ctx, name);
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

        let res = await stream.next();
        if (res.length > 0) {

            // Handling elements
            await handler(res, first);

            // Commit offset
            await inTx(async () => {
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
            return true;
        } else {
            return false;
        }
    });
} 