import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { lazyInject } from 'openland-modules/Modules.container';
import { RoomRepository } from './RoomRepository';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class PremiumChatRepository {
    @lazyInject('RoomRepository') private readonly room!: RoomRepository;
    async alterPaidChatUserPass(parent: Context, cid: number, uid: number, activeSubscription: string | boolean) {
        return await inTx(parent, async (ctx) => {
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

            if (isActive) {
                return await this.room.joinRoom(ctx, cid, uid, false);
            } else {
                return await this.room.kickFromRoom(ctx, cid, uid);
            }
        });
    }

}