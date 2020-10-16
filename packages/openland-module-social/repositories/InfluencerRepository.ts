import { injectable } from 'inversify';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
// import { createLogger } from '@openland/log';

// const log = createLogger('influencer');

@injectable()
export class InfluencerRepository {

    setMessagesSent = async (root: Context, uid: number, count: number) => {
        await inTx(root, async (ctx) => {
            let ind = await Store.UserInfluencerIndex.findById(ctx, uid);
            if (ind) {
                ind.value = count;
            } else {
                await Store.UserInfluencerIndex.create(ctx, uid, { value: count });
            }
            // log.log(ctx, 'Set influencer index of #' + uid + ' to ' + count);
        });
    }

    onMessageSent = async (root: Context, uid: number) => {
        await inTx(root, async (ctx) => {
            let ind = await Store.UserInfluencerIndex.findById(ctx, uid);
            if (ind) {
                ind.value = ind.value + 1;
                // log.log(ctx, 'Set influencer index of #' + uid + ' to ' + (ind.value + 1));
            } else {
                await Store.UserInfluencerIndex.create(ctx, uid, { value: 1 });
                // log.log(ctx, 'Set influencer index of #' + uid + ' to ' + 1);
            }
        });
    }
}