import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders } from '@openland/foundationdb';

const MODE_DIRECT = 0;
const MODE_ASYNC = 1;

export class SubscriberRepository {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    async getSubscriptionState(ctx: Context, subscriber: Buffer, feed: Buffer): Promise<{ mode: 'direct' | 'async', strict: boolean, seq: number } | null> {
        let ex = await this.subspace.get(ctx, Locations.subscriber.subscription(subscriber, feed));
        if (!ex) {
            return null;
        }
        return this.unpackState(ex);
    }

    async getSubscriptions(ctx: Context, subscriber: Buffer) {
        let all = await this.subspace.range(ctx, Locations.subscriber.subscriptionAll(subscriber));
        return all.map((v) => {
            let tp = encoders.tuple.unpack(v.key);
            let feed = tp[tp.length - 1] as Buffer;
            let state = this.unpackState(v.value);
            return {
                feed,
                state
            };
        });
    }

    private unpackState(src: Buffer) {
        let tuple = encoders.tuple.unpack(src);
        let mode: 'direct' | 'async';
        if (tuple[0] === MODE_DIRECT) {
            mode = 'direct';
        } else if (tuple[0] === MODE_ASYNC) {
            mode = 'async';
        } else {
            throw Error('Broken index');
        }
        let strict = tuple[1] as boolean;
        let seq = tuple[2] as number;
        return { mode, strict, seq };
    }

    async addSubscription(ctx: Context, subscriber: Buffer, feed: Buffer, mode: 'direct' | 'async', strict: boolean, seq: number) {
        if (await this.subspace.exists(ctx, Locations.subscriber.subscription(subscriber, feed))) {
            throw Error('Subscription already exists');
        }
        let type: Buffer;
        if (mode === 'direct') {
            type = encoders.tuple.pack([MODE_DIRECT, strict, seq]);
        } else if (mode === 'async') {
            type = encoders.tuple.pack([MODE_ASYNC, strict, seq]);
        } else {
            throw Error('Invalid mode');
        }
        this.subspace.set(ctx, Locations.subscriber.subscription(subscriber, feed), type);
    }

    async updateSubscription(ctx: Context, subscriber: Buffer, feed: Buffer, mode: 'direct' | 'async') {
        let ex = await this.getSubscriptionState(ctx, subscriber, feed);
        if (!ex) {
            throw Error('Subscription not exist');
        }
        if (ex.mode === mode) {
            return;
        }
        let type: Buffer;
        if (mode === 'direct') {
            type = encoders.tuple.pack([MODE_DIRECT, ex.strict, ex.seq]);
        } else if (mode === 'async') {
            type = encoders.tuple.pack([MODE_ASYNC, ex.strict, ex.seq]);
        } else {
            throw Error('Invalid mode');
        }
        this.subspace.set(ctx, Locations.subscriber.subscription(subscriber, feed), type);
    }

    async removeSubscription(ctx: Context, subscriber: Buffer, feed: Buffer) {
        let mode = await this.getSubscriptionState(ctx, subscriber, feed);
        if (!mode) {
            throw Error('Subscription not exist');
        }

        // Remove from common list
        this.subspace.clear(ctx, Locations.subscriber.subscription(subscriber, feed));

        return mode;
    }
}