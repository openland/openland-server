import { Store } from 'openland-module-db/FDB';
import { injectable } from 'inversify';
import { Context } from '@openland/context';

@injectable()
export class ChatMetricsRepository {

    onMessageSent = (ctx: Context, uid: number) => {
        Store.UserMessagesSentCounter.byId(uid).increment(ctx);
    }

    onMessageReceived = (ctx: Context, uid: number) => {
        Store.UserMessagesReceivedCounter.byId(uid).increment(ctx);
    }

    onMessageSentDirect = async (ctx: Context, uid: number, cid: number) => {
        Store.UserMessagesSentInDirectChatTotalCounter.byId(uid).increment(ctx);
        Store.UserMessagesSentInDirectChatCounter.byId(uid, cid).increment(ctx);
        let chat = await Store.ConversationPrivate.findById(ctx, cid);
        if (!chat) {
            return;
        }
        let senderSent = await Store.UserMessagesSentInDirectChatCounter.byId(uid, cid).get(ctx);
        let uid2 = chat.uid1 === uid ? chat.uid2 : chat.uid1;
        let u2Sent = await Store.UserMessagesSentInDirectChatCounter.byId(uid2, cid).get(ctx);
        if (senderSent === 1 && u2Sent >= 1) {
            Store.User2WayDirectChatsCounter.increment(ctx, chat.uid1);
            Store.User2WayDirectChatsCounter.increment(ctx, chat.uid2);
        }
    }

    onChannelJoined = (ctx: Context, uid: number) => {
        Store.UserMessagesChannelsCounter.byId(uid).increment(ctx);
    }

    onChannelLeave = (ctx: Context, uid: number) => {
        Store.UserMessagesChannelsCounter.byId(uid).decrement(ctx);
    }

    onChatCreated = (ctx: Context, uid: number) => {
        Store.UserMessagesChatsCounter.byId(uid).increment(ctx);
    }

    onChatDeleted = (ctx: Context, uid: number) => {
        Store.UserMessagesChatsCounter.byId(uid).decrement(ctx);
    }

    onDirectChatCreated = (ctx: Context, uid: number) => {
        Store.UserMessagesDirectChatsCounter.byId(uid).increment(ctx);
    }

    onDirectChatDeleted = (ctx: Context, uid: number) => {
        Store.UserMessagesDirectChatsCounter.byId(uid).decrement(ctx);
    }
}