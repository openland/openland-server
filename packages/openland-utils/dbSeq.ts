import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';

export async function fetchNextDBSeq(parent: Context, sequenceName: string) {
    return await inTx(parent, async (ctx) => {
        let ex = await Store.Sequence.findById(ctx, sequenceName);
        if (ex) {
            let res = ++ex.value;
            await ex.flush(ctx);
            return res;
        } else {
            await Store.Sequence.create(ctx, sequenceName, {value: 1});
            return 1;
        }
    });
}