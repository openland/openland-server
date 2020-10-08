import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders } from '@openland/foundationdb';

const MODE_DIRECT = 0;
const MODE_ASYNC = 1;
const ZERO = Buffer.from([0]);
const ONE = Buffer.from([1]);

export type SubscriberState = {
    generation: number,
    mode: 'async' | 'direct',
    strict: boolean,
    from: { seq: number, state: Buffer },
    to: { seq: number, state: Buffer } | null
};

function unpackState(src: Buffer): SubscriberState {
    let body: Buffer;
    let from: Buffer;
    let to: Buffer | null;
    if (src.readInt8(0) === 1) {
        body = src.slice(1, src.length - 12);
        from = src.slice(src.length - 12);
        to = null;
    } else {
        body = src.slice(1, src.length - 24);
        from = src.slice(src.length - 24, src.length - 12);
        to = src.slice(src.length - 12);
    }
    let tuple = encoders.tuple.unpack(body);
    let generation: number = tuple[0] as number;
    let mode: 'direct' | 'async';
    if (tuple[1] === MODE_DIRECT) {
        mode = 'direct';
    } else if (tuple[1] === MODE_ASYNC) {
        mode = 'async';
    } else {
        throw Error('Broken index');
    }
    let strict = tuple[2] as boolean;
    let fromSeq = tuple[3] as number;
    let toSeq = tuple[4] as (number | null);
    return {
        generation, 
        mode, 
        strict, 
        from: { state: from, seq: fromSeq }, 
        to: (toSeq !== null && to !== null ? { state: to, seq: toSeq } : null)
    };
}

function packState(src: { generation: number, mode: 'async' | 'direct', strict: boolean, from: number, to: number | null }) {
    let type: Buffer;
    if (src.mode === 'direct') {
        type = encoders.tuple.pack([src.generation, MODE_DIRECT, src.strict, src.from, src.to]);
    } else if (src.mode === 'async') {
        type = encoders.tuple.pack([src.generation, MODE_ASYNC, src.strict, src.from, src.to]);
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

    async getSubscriptionState(ctx: Context, subscriber: Buffer, feed: Buffer): Promise<SubscriberState | null> {
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

    async addSubscription(ctx: Context, subscriber: Buffer, feed: Buffer, mode: 'direct' | 'async', strict: boolean, seq: number, index: Buffer) {
        let generation = 1;
        let ex = await this.getSubscriptionState(ctx, subscriber, feed);
        if (ex) {
            // Check if already exist
            if (ex.to !== null) {
                throw Error('Subscription already exist');
            }
            generation = ex.generation + 1;
        }

        let value = Buffer.concat([ONE, packState({ generation, mode, strict, from: seq, to: null })]);
        this.subspace.setVersionstampedValue(ctx, Locations.subscriber.subscription(subscriber, feed), value, index);
    }

    async updateSubscriptionMode(ctx: Context, subscriber: Buffer, feed: Buffer, mode: 'direct' | 'async') {
        let state = await this.getSubscriptionState(ctx, subscriber, feed);
        if (!state || state.to !== null) {
            throw Error('Subscription not exist');
        }
        if (state.mode === mode) {
            return;
        }

        let value = Buffer.concat([ONE, packState({ generation: state.generation, mode, strict: state.strict, from: state.from.seq, to: null }), state.from.state]);
        this.subspace.set(ctx, Locations.subscriber.subscription(subscriber, feed), value);
    }

    async removeSubscription(ctx: Context, subscriber: Buffer, feed: Buffer, seq: number, index: Buffer) {
        let state = await this.getSubscriptionState(ctx, subscriber, feed);
        if (!state || state.to !== null) {
            throw Error('Subscription not exist');
        }

        let value = Buffer.concat([ZERO, packState({
            generation: state.generation,
            mode: state.mode,
            strict: state.strict,
            from: state.from.seq,
            to: seq
        }), state.from.state]);
        this.subspace.setVersionstampedValue(ctx, Locations.subscriber.subscription(subscriber, feed), value, index);
        return state.mode;
    }
}