import { lazyInject } from '../../openland-modules/Modules.container';
import { AsyncCountersRepository } from './AsyncCountersRepository';
import { Store } from '../../openland-module-db/FDB';
import { encoders, inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Metrics } from '../../openland-module-monitoring/Metrics';
import { UserReadSeqsDirectory } from './UserReadSeqsDirectory';
import { injectable } from 'inversify';
import { ChatsMembersListDirectory } from './ChatsMembersListDirectory';
import { SyncCountersRepository } from './SyncCountersRepository';
import { isDefined } from '../../openland-utils/misc';

@injectable()
export class HybridCountersRepository {
    @lazyInject('AsyncCountersRepository')
    readonly asyncCounters!: AsyncCountersRepository;

    @lazyInject('SyncCountersRepository')
    readonly syncCounters!: SyncCountersRepository;

    @lazyInject('ChatsMembersListDirectory')
    readonly chatMembers!: ChatsMembersListDirectory;

    private userMuteSettingsSubspace = Store.UserDialogMuteSettingDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.boolean);

    @lazyInject('UserReadSeqsDirectory')
    readonly userReadSeqs!: UserReadSeqsDirectory;

    fetchUserCounters = async (ctx: Context, uid: number, includeAllMention = true) => {
        let start = Date.now();
        let userReadSeqs = await this.userReadSeqs.getUserReadSeqs(ctx, uid);
        let userChats = await this.chatMembers.getUserChats(ctx, uid);

        let syncCounters = await this.syncCounters.fetchUserCounters(ctx, uid);

        let counters = await Promise.all(userChats.map(async chat => {
            if (chat.type === 'sync') {
                let counter = syncCounters.find(c => c.cid === chat.cid);
                if (counter) {
                    return counter;
                } else {
                    return { cid: chat.cid, unreadCounter: 0, haveMention: false };
                }
            } else {
                let lastReadSeq = userReadSeqs.find(s => s.cid === chat.cid)?.seq || 0;
                return await this.asyncCounters.fetchUserCounterForChat(ctx, uid, chat.cid, lastReadSeq);
            }
        }));

        Metrics.AllCountersResolveTime.report(Date.now() - start);
        return counters;
    }

    fetchUserCountersForChats = async (ctx: Context, uid: number, cids: number[], includeAllMention = true) => {
        let userReadSeqs = await this.userReadSeqs.getUserReadSeqs(ctx, uid);
        let userChats = await this.chatMembers.getUserChats(ctx, uid);
        let syncCounters = await this.syncCounters.fetchUserCounters(ctx, uid);

        return (await Promise.all(cids.map(async cid => {
            let chat = userChats.find(c => c.cid === cid);
            if (!chat) {
                return null;
            }
            if (chat.type === 'sync') {
                let counter = syncCounters.find(c => c.cid === cid);
                if (counter) {
                    return counter;
                } else {
                    return { cid: chat.cid, unreadCounter: 0, haveMention: false };
                }
            } else {
                let lastReadSeq = userReadSeqs.find(s => s.cid === cid)?.seq || 0;
                return await this.asyncCounters.fetchUserCounterForChat(ctx, uid, chat.cid, lastReadSeq);
            }
        }))).filter(isDefined);
    }

    fetchUserGlobalCounter = async (ctx: Context, uid: number, countChats: boolean, excludeMuted: boolean) => {
        let start = Date.now();
        let counters = await this.fetchUserCounters(ctx, uid);

        if (excludeMuted) {
            let mutedChats = await this.userMuteSettingsSubspace.range(ctx, [uid]);
            counters = counters.filter(c => !mutedChats.find(m => m.key[1] === c.cid));
        }

        let counter = 0;
        if (countChats) {
            counter = counters.filter(c => c.unreadCounter > 0).length;
        } else {
            counter = counters.reduce((acc, cur) => acc + cur.unreadCounter, 0);
        }

        Metrics.GlobalCounterResolveTime.report(Date.now() - start);
        return counter;
    }

    changeUserMembershipType = async (parent: Context, uid: number, cid: number, async: boolean) => {
        return await inTx(parent, async ctx => {
            this.chatMembers.changeMemberType(ctx, cid, uid, async);
            if (async) {
                await this.syncCounters.onDialogDeleted(ctx, uid, cid);
            } else {
                let lastReadSeq = await this.userReadSeqs.getUserReadSeqForChat(ctx, uid, cid);
                let counter = await this.asyncCounters.fetchUserCounterForChat(ctx, uid, cid, lastReadSeq);
                await this.syncCounters.setCounterForChat(ctx, uid, cid, counter.unreadCounter, counter.haveMention);
            }
        });
    }
}