import { singletonWorker } from '@openland/foundationdb-singleton';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';

export function declareUserAudienceCalculator() {
    singletonWorker({ db: Store.storage.db, name: `user_audience_calculator`, delay: 30000, startDelay: 0 }, async (parent) => {
        await inTx(parent, async ctx => {
            let activeChats = (await Store.ChatAudienceCalculatingQueue.active.query(ctx, { limit: 10 })).items;
            for (let chat of activeChats) {
                let members = await Store.RoomParticipant.active.findAll(ctx, chat.id);
                for (let member of members) {
                    await Store.UserAudienceCounter.add(ctx, member.uid, chat.delta);
                }
                chat.active = false;
            }
        });
    });
}