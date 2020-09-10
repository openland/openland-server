import { CounterProvider } from './CounterProvider';
import { Context } from '@openland/context';
import { UserStateRepository } from '../repositories/UserStateRepository';
import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { Store } from '../../openland-module-db/FDB';

@injectable()
export class PrecalculatedCounterProvider implements CounterProvider {
    @lazyInject('UserStateRepository')
    private readonly userState!: UserStateRepository;

    async fetchUserGlobalCounter(parent: Context, uid: number) {
        return this.userState.fetchUserGlobalCounter(parent, uid);
    }

    async fetchUserUnreadMessagesCount(parent: Context, uid: number) {
        return await Store.UserCounter.get(parent, uid);
    }

    async fetchUserCounters(parent: Context, uid: number) {
        return [];
    }

    async fetchUserCountersForChats(ctx: Context, uid: number, cids: number[], includeAllMention: boolean) {
        return await Promise.all(cids.map(async cid => {
            return {
                cid,
                unreadCounter: await Store.UserDialogCounter.get(ctx, uid, cid),
                haveMention: await Store.UserDialogHaveMention.get(ctx, uid, cid)
            };
        }));
    }

    async fetchUserUnreadInChat(ctx: Context, uid: number, cid: number) {
        return await Store.UserDialogCounter.get(ctx, uid, cid);
    }

    async fetchUserMentionedInChat(ctx: Context, uid: number, cid: number) {
        return await Store.UserDialogHaveMention.get(ctx, uid, cid);
    }
}