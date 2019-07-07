import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from './FDB';

export async function resolveSequenceNumber(parent: Context, key: string) {
    return await inTx(parent, async (ctx) => {
        let ex = await Store.Sequence.findById(ctx, key);
        let id: number;
        if (ex) {
            id = ++ex.value;
            await ex.flush(ctx);
        } else {
            await Store.Sequence.create(ctx, key, { value: 1 });
            id = 1;
        }
        return id;
    });
}