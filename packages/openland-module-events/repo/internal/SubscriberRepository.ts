import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders } from '@openland/foundationdb';

const MODE_DIRECT = 0;
const MODE_ASYNC = 1;

function unpackState(src: Buffer) {
    let tuple = encoders.tuple.unpack(src);
    let index: number = tuple[0] as number;
    let mode: 'direct' | 'async';
    if (tuple[1] === MODE_DIRECT) {
        mode = 'direct';
    } else if (tuple[1] === MODE_ASYNC) {
        mode = 'async';
    } else {
        throw Error('Broken index');
    }
    let strict = tuple[2] as boolean;
    let from = tuple[3] as number;
    let to = tuple[4] as (number | null);
    return { index, mode, strict, from, to };
}

function packState(src: { index: number, mode: 'async' | 'direct', strict: boolean, from: number, to: number | null }) {
    let type: Buffer;
    if (src.mode === 'direct') {
        type = encoders.tuple.pack([src.index, MODE_DIRECT, src.strict, src.from, src.to]);
    } else if (src.mode === 'async') {
        type = encoders.tuple.pack([src.index, MODE_ASYNC, src.strict, src.from, src.to]);
    } else {
        throw Error('Invalid mode');
    }
    return type;
}

export class SubscriberRepository {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    async getSubscriptionState(ctx: Context, subscriber: Buffer, feed: Buffer): Promise<{
        index: number,
        mode: 'direct' | 'async',
        strict: boolean,
        from: number,
        to: number | null
    } | null> {
        let ex = await this.subspace.get(ctx, Locations.subscriber.subscription(subscriber, feed));
        if (!ex) {
            return null;
        }
        return unpackState(ex);
    }

    async getSubscriptions(ctx: Context, subscriber: Buffer) {
        let all = await this.subspace.range(ctx, Locations.subscriber.subscriptionAll(subscriber));
        return all.map((v) => {
            let tp = encoders.tuple.unpack(v.key);
            let feed = tp[tp.length - 1] as Buffer;
            let state = unpackState(v.value);
            return {
                feed,
                state
            };
        });
    }

    async addSubscription(ctx: Context, subscriber: Buffer, feed: Buffer, mode: 'direct' | 'async', strict: boolean, seq: number) {
        let index = 1;
        let ex = await this.getSubscriptionState(ctx, subscriber, feed);
        if (ex) {
            // Check if already exist
            if (ex.to !== null) {
                throw Error('Subscription already exist');
            }
            index = ex.index + 1;
        }
        this.subspace.set(ctx, Locations.subscriber.subscription(subscriber, feed), packState({ index, mode, strict, from: seq, to: null }));
    }

    async updateSubscriptionMode(ctx: Context, subscriber: Buffer, feed: Buffer, mode: 'direct' | 'async') {
        let state = await this.getSubscriptionState(ctx, subscriber, feed);
        if (!state || state.to !== null) {
            throw Error('Subscription not exist');
        }
        if (state.mode === mode) {
            return;
        }
        this.subspace.set(ctx, Locations.subscriber.subscription(subscriber, feed), packState({ ...state, mode }));
    }

    async removeSubscription(ctx: Context, subscriber: Buffer, feed: Buffer, seq: number) {
        let state = await this.getSubscriptionState(ctx, subscriber, feed);
        if (!state || state.to !== null) {
            throw Error('Subscription not exist');
        }

        let updatedState = { ...state, to: seq };
        this.subspace.set(ctx, Locations.subscriber.subscription(subscriber, feed), packState(updatedState));
        return updatedState;
    }
}