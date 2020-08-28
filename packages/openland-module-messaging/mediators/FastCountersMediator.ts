import { Context } from '@openland/context';
import { lazyInject } from '../../openland-modules/Modules.container';
import { FastCountersRepository } from '../repositories/FastCountersRepository';
import { TransactionCache } from '@openland/foundationdb';
import { AsyncLock } from '../../openland-utils/timer';
import { injectable } from 'inversify';
import { Metrics } from '../../openland-module-monitoring/Metrics';

const lockCache = new TransactionCache<AsyncLock>('counters-fetch-lock');

function getLock(ctx: Context, key: string) {
    let cached = lockCache.get(ctx, key);
    if (cached) {
        return cached;
    }
    let lock = new AsyncLock();
    lockCache.set(ctx, key, lock);
    return lock;
}

@injectable()
export class FastCountersMediator {
    @lazyInject('FastCountersRepository')
    readonly repo!: FastCountersRepository;

    onMessageCreated = async (ctx: Context, uid: number, cid: number, seq: number, mentionedUsers: (number | 'all')[], hiddenForUsers: number[]) => {
        return this.repo.onMessageCreated(ctx, uid, cid, seq, mentionedUsers, hiddenForUsers);
    }

    onMessageDeleted = async (ctx: Context, cid: number, seq: number, mentionedUsers: (number | 'all')[], hiddenForUsers: number[]) => {
        return this.repo.onMessageDeleted(ctx, cid, seq, mentionedUsers, hiddenForUsers);
    }

    onMessageEdited = async (ctx: Context, cid: number, seq: number, oldMentions: (number | 'all')[], newMentions: (number | 'all')[]) => {
        return this.repo.onMessageEdited(ctx, cid, seq, oldMentions, newMentions);
    }

    onMessageRead = (ctx: Context, uid: number, cid: number, toSeq: number) => {
        return this.repo.onMessageRead(ctx, uid, cid, toSeq);
    }

    onAddDialog = async (ctx: Context, uid: number, cid: number) => {
        return this.repo.onAddDialog(ctx, uid, cid);
    }

    onRemoveDialog = (ctx: Context, uid: number, cid: number) => {
        return this.repo.onRemoveDialog(ctx, uid, cid);
    }

    /**
     * Caches result in transaction & avoids cache misses in case of parallel calls
     */
    fetchUserCounters = async (ctx: Context, uid: number, includeAllMention = true) => {
        return await getLock(ctx, 'fetch-counters').inLock(async () => {
            let start = Date.now();
            try {
                return this.repo.fetchUserCounters(ctx, uid, includeAllMention);
            } finally {
                Metrics.AllCountersResolveTime.report(Date.now() - start);
            }
        });
    }

    /**
     * Does no caching should be called once in tx
     */
    fetchUserCountersForChats = async (ctx: Context, uid: number, cids: number[], includeAllMention = true) => {
        return this.repo.fetchUserCountersForChats(ctx, uid, cids);
    }

    /**
     * Caches result in transaction & avoids cache misses in case of parallel calls
     */
    fetchUserGlobalCounter = async (ctx: Context, uid: number, countChats: boolean, excludeMuted: boolean) => {
        return await getLock(ctx, 'fetch-global-counter').inLock(async () => {
            let start = Date.now();
            try {
                return this.repo.fetchUserGlobalCounter(ctx, uid, countChats, excludeMuted);
            } finally {
                Metrics.GlobalCounterResolveTime.report(Date.now() - start);
            }
        });
    }
}