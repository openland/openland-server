import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/store';
import { AllEntities } from '../../openland-module-db/schema';

@injectable()
export class ChatMetricsRepository {

    @lazyInject('Store')
    private readonly store!: Store;
    @lazyInject('FDB')
    private readonly fdb!: AllEntities;

    onMessageSent = (ctx: Context, uid: number) => {
        this.store.UserMessagesSentCounter.byId(uid).increment(ctx);
    }

    onMessageReceived = (ctx: Context, uid: number) => {
        this.store.UserMessagesReceivedCounter.byId(uid).increment(ctx);
    }

    onMessageSentDirect = async (ctx: Context, uid: number, cid: number) => {
        this.store.UserMessagesSentInDirectChatTotalCounter.byId(uid).increment(ctx);
        this.store.UserMessagesSentInDirectChatCounter.byId(uid, cid).increment(ctx);
        let chat = await this.fdb.ConversationPrivate.findById(ctx, cid);
        if (!chat) {
            return;
        }
        let senderSent = await this.store.UserMessagesSentInDirectChatCounter.byId(uid, cid).get(ctx);
        let uid2 = chat.uid1 === uid ? chat.uid2 : chat.uid1;
        let u2Sent = await this.store.UserMessagesSentInDirectChatCounter.byId(uid2, cid).get(ctx);
        if (senderSent === 1 && u2Sent >= 1) {
            await this.store.User2WayDirectChatsCounter.increment(ctx, chat.uid1);
            await this.store.User2WayDirectChatsCounter.increment(ctx, chat.uid2);
        }
    }

    onChatCreated = (ctx: Context, uid: number) => {
        this.store.UserMessagesChatsCounter.byId(uid).increment(ctx);
    }

    onChatDeleted = (ctx: Context, uid: number) => {
        this.store.UserMessagesChatsCounter.byId(uid).decrement(ctx);
    }

    onDirectChatCreated = (ctx: Context, uid: number) => {
        this.store.UserMessagesDirectChatsCounter.byId(uid).increment(ctx);
    }

    onDirectChatDeleted = (ctx: Context, uid: number) => {
        this.store.UserMessagesDirectChatsCounter.byId(uid).decrement(ctx);
    }
}