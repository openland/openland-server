import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { AllEntities } from './schema';

export async function resolveSequenceNumber(parent: Context, entities: AllEntities, key: string) {
    return await inTx(parent, async (ctx) => {
        let ex = await entities.Sequence.findById(ctx, key);
        let id: number;
        if (ex) {
            id = ++ex.value;
            await ex.flush(ctx);
        } else {
            await entities.Sequence.create(ctx, key, { value: 1 });
            id = 1;
        }
        return id;
    });
}