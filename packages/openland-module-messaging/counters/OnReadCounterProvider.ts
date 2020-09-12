import { injectable } from 'inversify';
import { CounterProvider } from './CounterProvider';
import { lazyInject } from '../../openland-modules/Modules.container';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';
import { FastCountersMediator } from '../mediators/FastCountersMediator';
import { USE_NEW_COUNTERS } from '../MessagingModule';

@injectable()
export class OnReadCounterProvider implements CounterProvider {
    @lazyInject('FastCountersMediator')
    private readonly fastCounters!: FastCountersMediator;

    async fetchUserGlobalCounter(parent: Context, uid: number) {
        let settings = await Modules.Users.getUserSettings(parent, uid);
        let counterType = settings.globalCounterType || 'unread_chats_no_muted';

        if (counterType === 'unread_messages') {
            return this.fastCounters.fetchUserGlobalCounter(parent, uid, false, false);
        } else if (counterType === 'unread_chats') {
            return this.fastCounters.fetchUserGlobalCounter(parent, uid, true, false);
        } else if (counterType === 'unread_messages_no_muted') {
            return this.fastCounters.fetchUserGlobalCounter(parent, uid, false, true);
        } else if (counterType === 'unread_chats_no_muted') {
            return this.fastCounters.fetchUserGlobalCounter(parent, uid, true, true);
        }
        return this.fastCounters.fetchUserGlobalCounter(parent, uid, true, true);
    }

    async fetchUserUnreadMessagesCount(parent: Context, uid: number) {
        return await this.fastCounters.fetchUserGlobalCounter(parent, uid, false, false);
    }

    async fetchUserCounters(parent: Context, uid: number) {
        return this.fastCounters.fetchUserCounters(parent, uid);
    }

    async fetchUserCountersForChats(ctx: Context, uid: number, cids: number[], includeAllMention: boolean) {
        return this.fastCounters.fetchUserCountersForChats(ctx, uid, cids, includeAllMention);
    }

    /**
     * Fetches all counters & caches, call this only if you fetch global counter in same tx
     * or if you call this for several chats in same tx
     */
    async fetchUserUnreadInChat(ctx: Context, uid: number, cid: number) {
        let counters = await this.fastCounters.fetchUserCounters(ctx, uid);

        let chatUnread = counters.find(c => c.cid === cid);
        if (!chatUnread) {
            return 0;
        }
        return chatUnread.unreadCounter;
    }

    /**
     * Fetches all counters & caches, call this only if you fetch global counter in same tx
     * or if you call this for several chats in same tx
     */
    async fetchUserMentionedInChat(ctx: Context, uid: number, cid: number) {
        if (!USE_NEW_COUNTERS) {
            return await Store.UserDialogHaveMention.get(ctx, uid, cid);
        }
        let counters = await this.fastCounters.fetchUserCounters(ctx, uid);
        let chatUnread = counters.find(c => c.cid === cid);
        if (!chatUnread) {
            return false;
        }
        return chatUnread.haveMention;
    }
}