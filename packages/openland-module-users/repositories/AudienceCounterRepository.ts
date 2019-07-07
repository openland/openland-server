import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class AudienceCounterRepository {
    async addToCalculatingQueue(parent: Context, cid: number, membersCountDelta: number) {
        return await inTx(parent, async ctx => {
            // Only public chats from communities should pass to queue
            let chat = await Store.Conversation.findById(ctx, cid);
            if (!chat || chat.kind !== 'room') {
                return;
            }
            let room = (await Store.ConversationRoom.findById(ctx, cid))!;
            if (room.kind !== 'public' || !room.oid) {
                return;
            }
            let org = await Store.Organization.findById(ctx, room.oid);
            if (!org || org.kind !== 'community' || org.private) {
                return;
            }

            let existing = await Store.ChatAudienceCalculatingQueue.findById(ctx, cid);
            if (!existing) {
                return await Store.ChatAudienceCalculatingQueue.create(ctx, cid, { delta: membersCountDelta, active: true });
            }
            if (existing.active) {
                existing.delta += membersCountDelta;
            } else {
                existing.delta = membersCountDelta;
                existing.active = true;
            }
            return existing;
        });
    }
}