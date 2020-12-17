import { CounterProvider } from './CounterProvider';
import { Context } from '@openland/context';
import { injectable } from 'inversify';
import { Modules } from 'openland-modules/Modules';

@injectable()
export class PrecalculatedCounterProvider implements CounterProvider {

    async fetchUserGlobalCounter(ctx: Context, uid: number) {
        let settings = await Modules.Users.getUserSettings(ctx, uid);
        if (settings.globalCounterType === 'unread_messages') {
            return await Modules.Messaging.messaging.counters.getGlobalCounter(ctx, uid, false, 'all');
        } else if (settings.globalCounterType === 'unread_messages_no_muted') {
            return await Modules.Messaging.messaging.counters.getGlobalCounter(ctx, uid, true, 'all');
        } else if (settings.globalCounterType === 'unread_chats') {
            return await Modules.Messaging.messaging.counters.getGlobalCounter(ctx, uid, false, 'distinct');
        } else if (settings.globalCounterType === 'unread_chats_no_muted') {
            return await Modules.Messaging.messaging.counters.getGlobalCounter(ctx, uid, true, 'distinct');
        }

        // Default counter
        return await Modules.Messaging.messaging.counters.getGlobalCounter(ctx, uid, false, 'all');
    }

    async fetchUserUnreadMessagesCount(parent: Context, uid: number) {
        return await Modules.Messaging.messaging.counters.getGlobalCounter(parent, uid, false, 'all');
    }

    async fetchUserCountersForChats(ctx: Context, uid: number, cids: number[], includeAllMention: boolean) {
        return await Promise.all(cids.map(async cid => {
            let counters = await Modules.Messaging.messaging.counters.getLocalCounter(ctx, uid, cid);
            return {
                cid,
                unreadCounter: counters.unread,
                haveMention: counters.unreadMentions > 0
            };
        }));
    }

    async fetchUserUnreadInChat(ctx: Context, uid: number, cid: number) {
        let counters = await Modules.Messaging.messaging.counters.getLocalCounter(ctx, uid, cid);
        return counters.unread;
    }

    async fetchUserMentionsInChat(ctx: Context, uid: number, cid: number) {
        let counters = await Modules.Messaging.messaging.counters.getLocalCounter(ctx, uid, cid);
        return counters.unreadMentions;
    }
}