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

    async getSubscriptionState(ctx: Context, subscriber: Buffer, feed: Buffer): Promise<'direct' | 'async' | null> {
        let ex = await this.subspace.get(ctx, Locations.subscriber.subscription(subscriber, feed));
        if (!ex) {
            return null;
        }
        let tuple = encoders.tuple.unpack(ex);
        if (tuple[0] === MODE_DIRECT) {
            return 'direct';
        } else if (tuple[0] === MODE_ASYNC) {
            return 'async';
        } else {
            throw Error('Broken index');
        }
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