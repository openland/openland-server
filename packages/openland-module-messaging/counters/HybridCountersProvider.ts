import { injectable } from 'inversify';
import { CounterProvider } from './CounterProvider';
import { lazyInject } from '../../openland-modules/Modules.container';
import { Context } from '@openland/context';
import { Modules } from '../../openland-modules/Modules';
import { HybridCountersRepository } from '../repositories/HybridCountersRepository';

@injectable()
export class HybridCountersProvider implements CounterProvider {
    @lazyInject('HybridCountersRepository')
    private readonly counters!: HybridCountersRepository;

    async fetchUserGlobalCounter(parent: Context, uid: number) {
        let settings = await Modules.Users.getUserSettings(parent, uid);
        let counterType = settings.globalCounterType || 'unread_chats_no_muted';

        if (counterType === 'unread_messages') {
            return this.counters.fetchUserGlobalCounter(parent, uid, false, false);
        } else if (counterType === 'unread_chats') {
            return this.counters.fetchUserGlobalCounter(parent, uid, true, false);
        } else if (counterType === 'unread_messages_no_muted') {
            return this.counters.fetchUserGlobalCounter(parent, uid, false, true);
        } else if (counterType === 'unread_chats_no_muted') {
            return this.counters.fetchUserGlobalCounter(parent, uid, true, true);
        }
        return this.counters.fetchUserGlobalCounter(parent, uid, true, true);
    }

    async fetchUserUnreadMessagesCount(parent: Context, uid: number) {
        return await this.counters.fetchUserGlobalCounter(parent, uid, false, false);
    }

    async fetchUserCounters(parent: Context, uid: number) {
        return this.counters.fetchUserCounters(parent, uid);
    }

    async fetchUserCountersForChats(ctx: Context, uid: number, cids: number[], includeAllMention: boolean) {
        return this.counters.fetchUserCountersForChats(ctx, uid, cids, includeAllMention);
    }

    async fetchUserUnreadInChat(ctx: Context, uid: number, cid: number) {
        let counters = await this.counters.fetchUserCounters(ctx, uid);

        let chatUnread = counters.find(c => c.cid === cid);
        if (!chatUnread) {
            return 0;
        }
        return chatUnread.unreadCounter;
    }

    async fetchUserMentionedInChat(ctx: Context, uid: number, cid: number) {
        let counters = await this.counters.fetchUserCounters(ctx, uid);
        let chatUnread = counters.find(c => c.cid === cid);
        if (!chatUnread) {
            return false;
        }
        return chatUnread.haveMention;
    }
}