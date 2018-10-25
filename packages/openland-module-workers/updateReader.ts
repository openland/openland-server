import { FEntity } from 'foundation-orm/FEntity';
import { FStream } from 'foundation-orm/FStream';
import { staticWorker } from './staticWorker';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export function updateReader<T extends FEntity>(name: string, version: number, stream: FStream<T>, handler: (items: T[]) => Promise<void>) {
    staticWorker({ name: 'update_reader_' + name, version }, async () => {

        let existing = await FDB.ReaderState.findById(name);
        if (existing) {
            stream.seek(existing.cursor);
        } else {
            stream.reset();
        }

        let res = await stream.next();
        if (res.length > 0) {
            
            // Handling elements
            await handler(res);

            // Commit offset
            await inTx(async () => {
                let latest = await FDB.ReaderState.findById(name);
                if (existing && latest) {
                    // Update if not changed
                    if (existing.versionCode === latest.versionCode) {
                        latest.cursor = stream.cursor;
                    }
                } else if (!latest) {
                    await FDB.ReaderState.create(name, { cursor: stream.cursor });
                }
            });
            return true;
        } else {
            return false;
        }
    });
} 