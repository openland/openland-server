import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class PremiumChatRepository {
    async alterPaidChatUserPass(parent: Context, cid: number, uid: number, activeSubscription: string | boolean) {
        await inTx(parent, async (ctx) => {
            let isActive = !!activeSubscription;
            let pass = await Store.PremiumChatUserPass.findById(ctx, cid, uid);
            if (!pass) {
                pass = await Store.PremiumChatUserPass.create(ctx, cid, uid, { isActive });
            }
            if (typeof activeSubscription === 'string') {
                pass.sid = activeSubscription;
            }
            pass.isActive = isActive;
            await pass.flush(ctx);
        });
    }
}