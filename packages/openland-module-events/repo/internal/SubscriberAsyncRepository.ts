import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders, TupleItem } from '@openland/foundationdb';

export class SubscriberAsyncRepository {

    readonly subspace: Subspace<TupleItem[], TupleItem[]>;

    constructor(subspace: Subspace) {
        this.subspace = subspace
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.tuple);
    }

    async addSubscriber(ctx: Context, subscriber: Buffer, feed: Buffer, expires: number | null) {
        this.subspace.set(ctx, Locations.subscriber.async(subscriber, feed), []);
        if (expires !== null) {
            this.subspace.set(ctx, Locations.feed.asyncOnlineItem(feed, subscriber, expires), []);
        }
    }

    async removeSubscriber(ctx: Context, subscriber: Buffer, feed: Buffer, expires: number | null) {
        this.subspace.clear(ctx, Locations.subscriber.async(subscriber, feed));
        if (expires !== null) {
            this.subspace.clear(ctx, Locations.feed.asyncOnlineItem(feed, subscriber, expires));
        }
    }

    async getSubscriberFeeds(ctx: Context, subscriber: Buffer) {
        let direct = await this.subspace.range(ctx, Locations.subscriber.asyncAll(subscriber));
        let res: Buffer[] = [];
        for (let d of direct) {
            res.push(d.key[d.key.length - 1] as Buffer);
        }
        return res;
    }

    async getOnlineSubscribers(ctx: Context, feed: Buffer, now: number) {
        let location = Locations.feed.asyncOnlineAll(feed);
        let onlines = await this.subspace.range(ctx, location, { after: Locations.feed.asyncOnlineAfter(feed, now) });
        let res: Buffer[] = [];
        for (let on of onlines) {
            res.push(on.key[on.key.length - 1] as Buffer);
        }
        return res;
    }

    async setSubscriberOnline(ctx: Context, subscriber: Buffer, expires: number, previous: number | null) {

        // Clear previous value
        let feeds = await this.getSubscriberFeeds(ctx, subscriber);

        // Remove previous
        if (previous !== null) {
            for (let f of feeds) {
                this.subspace.clear(ctx, Locations.feed.asyncOnlineItem(f, subscriber, previous));
            }
        }

        // Write new value
        for (let f of feeds) {
            this.subspace.set(ctx, Locations.feed.asyncOnlineItem(f, subscriber, expires), []);
        }
    }
}