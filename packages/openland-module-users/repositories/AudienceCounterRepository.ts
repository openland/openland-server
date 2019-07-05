import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { AllEntities } from '../../openland-module-db/schema';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';

@injectable()
export class AudienceCounterRepository {
    @lazyInject('FDB')
    private readonly fdb!: AllEntities;

    async addToCalculatingQueue(parent: Context, cid: number, membersCountDelta: number) {
        return await inTx(parent, async ctx => {
            // Only public chats from communities should pass to queue
            let chat = await this.fdb.Conversation.findById(ctx, cid);
            if (!chat || chat.kind !== 'room') {
                return;
            }
            let room = (await this.fdb.ConversationRoom.findById(ctx, cid))!;
            if (room.kind !== 'public' || !room.oid) {
                return;
            }
            let org = await this.fdb.Organization.findById(ctx, room.oid);
            if (!org || org.kind !== 'community' || org.private) {
                return;
            }

            let existing = await this.fdb.ChatAudienceCalculatingQueue.findById(ctx, cid);
            if (!existing) {
                return await this.fdb.ChatAudienceCalculatingQueue.create(ctx, cid, { delta: membersCountDelta, active: true });
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