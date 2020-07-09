import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../openland-module-db/FDB';
import { encoders, inTx } from '@openland/foundationdb';
import { cursorToTuple, tupleToCursor } from '@openland/foundationdb-entity/lib/indexes/utils';

import { singletonWorker } from '@openland/foundationdb-singleton';
import { container } from '../openland-modules/Modules.container';
import { StreamProps } from '@openland/foundationdb-entity';

export function presenceLogReader<T>(version: number, batchSize: number, handler: (items: { date: number, uid: number }[], first: boolean, ctx: Context) => Promise<void>, args?: { delay: number }) {
    let repo = container.get<PresenceLogRepository>('PresenceLogRepository');
    singletonWorker({ name: 'presence_log_reader', version, delay: args && args.delay, db: Store.storage.db }, async (root) => {
        let existing = await inTx(root, async (ctx) => await Store.ReaderState.findById(ctx, 'presence_log_reader'));
        let first = false;
        let cursor: string | undefined = undefined;
        if (existing) {
            if (existing.version === null || existing.version < version) {
                first = true;
            } else {
                cursor = existing.cursor;
            }
        } else {
            first = true;
        }

        let next = async () => {
            let data = await inTx(root, async ctx => await repo.range(ctx, { after: cursor, batchSize: batchSize }));
            if (data.length > 0) {
                cursor = data[data.length - 1].cursor;
            }
            return data;
        };

        let res = await next();
        if (res.length > 0) {

            // Handling elements
            await handler(res, first, root);

            // Commit offset
            await inTx(root, async (ctx) => {
                let latest = await Store.ReaderState.findById(ctx, 'presence_log_reader');
                if (existing && latest) {
                    // Update if not changed
                    if (existing.metadata.versionCode === latest.metadata.versionCode) {
                        latest.cursor = cursor!;
                        latest.version = version;
                    }
                } else if (!latest) {
                    await Store.ReaderState.create(ctx, 'presence_log_reader', { cursor: cursor!, version: version });
                }
            });
        }
    });
}

@injectable()
export class PresenceLogRepository {
    logOnline(ctx: Context, uid: number) {
        let now = Date.now();
        Store.PresenceLogDirectory
            .withKeyEncoding(encoders.tuple)
            .set(ctx, [now - now % (60 * 1000), uid], Buffer.from([]));

    }

    async range(ctx: Context, opts: StreamProps | undefined) {
        let values = await Store.PresenceLogDirectory
            .withKeyEncoding(encoders.tuple)
            .range(ctx, [], {
                after: opts?.after ? cursorToTuple(opts.after) : undefined,
                reverse: opts?.reverse,
                limit: opts?.batchSize
            });

        return values.map(a => ({ date: a.key[0] as number, uid: a.key[1] as number, cursor: tupleToCursor(a.key) }));
    }
}