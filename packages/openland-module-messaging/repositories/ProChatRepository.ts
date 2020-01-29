import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { lazyInject } from 'openland-modules/Modules.container';
import { RoomRepository } from './RoomRepository';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class ProChatRepository {
    @lazyInject('RoomRepository') private readonly room!: RoomRepository;
    async alterPaidChatUserPass(parent: Context, cid: number, uid: number, activeSubscription: string | false) {
        return await inTx(parent, async (ctx) => {
            let pass = await Store.ProChatUserPass.findById(ctx, cid, uid);
            if (!pass) {
                pass = await Store.ProChatUserPass.create(ctx, cid, uid, { isActive: !!activeSubscription, sid: activeSubscription ? activeSubscription : null });
            }
            pass.isActive = !!activeSubscription;
            await pass.flush(ctx);

            if (activeSubscription) {
                return await this.room.joinRoom(ctx, cid, uid, false);
            } else {
                return await this.room.kickFromRoom(ctx, cid, uid);
            }
        });
    }

}