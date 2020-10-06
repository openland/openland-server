import { SubscriberRepository } from './internal/SubscriberRepository';
import { SubscriberDirectRepository } from './internal/SubscriberDirectRepository';
import { SubscriberAsyncRepository } from './internal/SubscriberAsyncRepository';
import { SubscriberSeqRepository } from './internal/SubscriberSeqRepository';
import { Context } from '@openland/context';
import { VersionStampRepository } from './internal/VersionStampRepository';
import { RegistryRepository } from './internal/RegistryRepository';
import { Subspace, inTxLeaky } from '@openland/foundationdb';
import { FeedSeqRepository } from './internal/FeedSeqRepository';
import { FeedEventsRepository } from './internal/FeedEventsRepository';
import { FeedLatestRepository } from './internal/FeedLatestRepository';

export class EventsRepository {
    readonly subspace: Subspace;

    readonly feedLatest: FeedLatestRepository;
    readonly feedEvents: FeedEventsRepository;
    readonly feedSeq: FeedSeqRepository;

    readonly sub: SubscriberRepository;
    readonly subSeq: SubscriberSeqRepository;
    readonly subAsync: SubscriberAsyncRepository;
    readonly subDirect: SubscriberDirectRepository;

    readonly vts: VersionStampRepository;
    readonly registry: RegistryRepository;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
        this.feedLatest = new FeedLatestRepository(subspace);
        this.feedEvents = new FeedEventsRepository(subspace);
        this.feedSeq = new FeedSeqRepository(subspace);
        this.registry = new RegistryRepository(subspace);
        this.subSeq = new SubscriberSeqRepository(subspace);
        this.sub = new SubscriberRepository(subspace);
        this.subAsync = new SubscriberAsyncRepository(subspace);
        this.subDirect = new SubscriberDirectRepository(subspace);
        this.vts = new VersionStampRepository(subspace.db);
    }

    //
    // Feed/Subscriber
    //

    async createFeed(parent: Context) {
        return await inTxLeaky(parent, async (ctx) => {

            // Allocate feed id
            let feed = await this.registry.allocateFeedId(ctx);

            // Set initial seq
            let seq = 0;
            this.feedSeq.setSeq(ctx, feed, seq);

            // Set initial latest
            let index = this.vts.allocateVersionstampIndex(ctx);
            await this.feedLatest.writeLatest(ctx, feed, seq, index);

            return feed;
        });
    }

    async createSubscriber(parent: Context) {
        return await inTxLeaky(parent, async (ctx) => {
            let subs = await this.registry.allocateSubscriberId(ctx);
            return subs;
        });
    }

    //
    // Subscriber online
    //

    async isOnline(parent: Context, subscriber: Buffer, now: number) {
        let clamped = Math.floor(now / 1000);

        return await inTxLeaky(parent, async (ctx) => {
            return await this.subSeq.isOnline(ctx, subscriber, clamped);
        });
    }

    async refreshOnline(parent: Context, subscriber: Buffer, expires: number) {
        let clamped = Math.floor(expires / 1000);

        await inTxLeaky(parent, async (ctx) => {
            await this.subSeq.refreshOnline(ctx, subscriber, clamped);
            await this.subAsync.setSubscriberOnline(ctx, subscriber, clamped);
        });
    }

    async getFeedOnlineSubscribers(parent: Context, feed: Buffer, now: number) {
        let clamped = Math.floor(now / 1000);

        return await inTxLeaky(parent, async (ctx) => {
            let directSubscribers = await this.subDirect.getFeedSubscribers(ctx, feed);
            let asyncOnlineSubscribers = await this.subAsync.getOnlineSubscribers(ctx, feed, clamped);

            let directWithOnline = await Promise.all(
                directSubscribers.map(
                    async (sub) => ({
                        sub,
                        online: await this.subSeq.isOnline(ctx, sub, clamped)
                    })
                ));
            return [...directWithOnline.filter((v) => v.online).map((v) => v.sub), asyncOnlineSubscribers];
        });
    }
}