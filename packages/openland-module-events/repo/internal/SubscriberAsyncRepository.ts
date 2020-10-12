import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders } from '@openland/foundationdb';

const ZERO = Buffer.alloc(0);
export class SubscriberAsyncRepository {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    async addSubscriber(ctx: Context, subscriber: Buffer, feed: Buffer) {
        this.subspace.set(ctx, Locations.subscriber.async(subscriber, feed), ZERO);

        let latestOnline = await this.subspace.get(ctx, Locations.subscriber.asyncOnlineLatest(subscriber));
        if (latestOnline) {
            encoders.int32BE.unpack(latestOnline); // Just in case check validity of data
            this.subspace.set(ctx, Buffer.concat([Locations.subscriber.asyncOnline(feed), latestOnline, subscriber]), ZERO);
        }
    }

    async removeSubscriber(ctx: Context, subscriber: Buffer, feed: Buffer) {
        this.subspace.clear(ctx, Locations.subscriber.async(subscriber, feed));

        let latestOnline = await this.subspace.get(ctx, Locations.subscriber.asyncOnlineLatest(subscriber));
        if (latestOnline) {
            encoders.int32BE.unpack(latestOnline); // Just in case check validity of data
            this.subspace.clear(ctx, Buffer.concat([Locations.subscriber.asyncOnline(feed), latestOnline, subscriber]));
        }
    }

    async getSubscriberFeeds(ctx: Context, subscriber: Buffer) {
        let direct = await this.subspace.range(ctx, Locations.subscriber.asyncAll(subscriber));
        let res: Buffer[] = [];
        for (let d of direct) {
            let tuple = encoders.tuple.unpack(d.key);
            res.push(tuple[tuple.length - 1] as Buffer);
        }
        return res;
    }

    async getOnlineSubscribers(ctx: Context, feed: Buffer, now: number) {
        let location = Locations.subscriber.asyncOnline(feed);
        let onlines = await this.subspace.range(ctx, location, { after: Buffer.concat([location, encoders.int32BE.pack(now)]) });
        let res: Buffer[] = [];
        for (let on of onlines) {
            let subscriber = on.key.slice(location.length + 4);
            res.push(subscriber);
        }
        return res;
    }

    async setSubscriberOnline(ctx: Context, subscriber: Buffer, expires: number) {

        // Clear previous value
        let feeds = await this.getSubscriberFeeds(ctx, subscriber);
        let ex = await this.subspace.get(ctx, Locations.subscriber.asyncOnlineLatest(subscriber));
        if (ex) {
            let oldExpires = encoders.int32BE.unpack(ex);
            if (expires < oldExpires) {
                return;
            }
            for (let f of feeds) {
                this.subspace.clear(ctx, Buffer.concat([Locations.subscriber.asyncOnline(f), ex, subscriber]));
            }
        }

        // Write new value
        let expiresPacked = encoders.int32BE.pack(expires);
        this.subspace.set(ctx, Locations.subscriber.asyncOnlineLatest(subscriber), expiresPacked);
        for (let f of feeds) {
            this.subspace.set(ctx, Buffer.concat([Locations.subscriber.asyncOnline(f), expiresPacked, subscriber]), ZERO);
        }
    }
}