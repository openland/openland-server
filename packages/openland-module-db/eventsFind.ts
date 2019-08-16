import { Context } from '@openland/context';
import { EventStore, PrimaryKeyType } from '@openland/foundationdb-entity';
import { encoders } from '@openland/foundationdb';

const emptyBuffer = Buffer.of();

export async function eventsFind(ctx: Context, store: EventStore, key: PrimaryKeyType[], opts?: {
    limit?: number | undefined | null,
    reverse?: boolean | undefined | null,
    after?: Buffer | undefined | null,
    afterCursor?: string | undefined | null
}) {
    let after: Buffer | undefined = undefined;
    if (opts && opts.afterCursor) {
        after = Buffer.from(opts.afterCursor, 'base64');
    } else if (opts && opts.after) {
        after = opts.after;
    }

    let res = await store.descriptor.subspace.subspace(encoders.tuple.pack(key)).range(ctx, emptyBuffer, {
        limit: opts && opts.limit ? (opts.limit + 1) : undefined,
        reverse: opts && opts.reverse ? opts.reverse : undefined,
        after
    });

    let items = res.map(v => ({ event: store.descriptor.factory.decode(v.value), key: v.key }));
    if (opts && opts.limit) {
        let haveMore = items.length > opts.limit;
        if (haveMore) {
            items.splice(items.length - 1, 1);
            return {
                items,
                cursor: res[res.length - 2] && res[res.length - 2].key.toString('base64'),
                haveMore: haveMore
            };
        } else {
            return {
                items,
                cursor: res[res.length - 1] && res[res.length - 1].key.toString('base64'),
                haveMore: haveMore
            };
        }
    }

    return {
        items,
        cursor: res[res.length - 1] && res[res.length - 1].key.toString('base64'),
        haveMore: false
    };
}