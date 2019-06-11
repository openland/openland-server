import { Context } from '@openland/context';
import { inTx } from '../foundation-orm/inTx';
import { FDB } from '../openland-module-db/FDB';

export async function fetchNextDBSeq(parent: Context, sequenceName: string) {
    return await inTx(parent, async (ctx) => {
        let ex = await FDB.Sequence.findById(ctx, sequenceName);
        if (ex) {
            let res = ++ex.value;
            await ex.flush(ctx);
            return res;
        } else {
            await FDB.Sequence.create(ctx, sequenceName, {value: 1});
            return 1;
        }
    });
}