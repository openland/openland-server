import { BufferSet } from './../../utils/BufferSet';
import { VersionstampRef, Versionstamp } from '@openland/foundationdb-tuple';
import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders } from '@openland/foundationdb';

const MODE_DIRECT = 0;
const MODE_ASYNC = 1;
const PLUS_ONE = encoders.int32LE.pack(1);
const MINUS_ONE = encoders.int32LE.pack(-1);

export type SubscriberState = {
    generation: number,
    mode: 'async' | 'direct',
    forwardOnly: boolean,
    subscribed: boolean,
    from: { seq: number, state: Buffer },
    to: { seq: number, state: Buffer } | null
};

export type SubscriberDescriptor = {
    generation: number,
    mode: 'async' | 'direct',
    forwardOnly: boolean,
    subscribed: boolean
};

function unpackDescription(src: Buffer): {
    generation: number,
    mode: 'async' | 'direct',
    forwardOnly: boolean,
    subscribed: boolean
} {
    let tuple = encoders.tuple.unpack(src);
    let generation: number = tuple[0] as number;
    let mode: 'direct' | 'async';
    if (tuple[1] === MODE_DIRECT) {
        mode = 'direct';
    } else if (tuple[1] === MODE_ASYNC) {
        mode = 'async';
    } else {
        throw Error('Broken index');
    }
    let forwardOnly = tuple[2] as boolean;
    let subscribed = tuple[3] as boolean;
    return {
        generation,
        mode,
        forwardOnly,
        subscribed
    };
}

function packDescription(src: { generation: number, mode: 'async' | 'direct', forwardOnly: boolean, subscribed: boolean }) {
    let type: Buffer;
    if (src.mode === 'direct') {
        type = encoders.tuple.pack([src.generation, MODE_DIRECT, src.forwardOnly, src.subscribed]);
    } else if (src.mode === 'async') {
        type = encoders.tuple.pack([src.generation, MODE_ASYNC, src.forwardOnly, src.subscribed]);
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

    async isSubscribed(ctx: Context, subscriber: Buffer, feed: Buffer) {
        let descriptor = await this.getSubscriptionDescriptor(ctx, subscriber, feed);
        if (!descriptor) {
            return false;
        }
        return descriptor.subscribed;
    }

    async getSubscriptionState(ctx: Context, subscriber: Buffer, feed: Buffer): Promise<SubscriberState | null> {
        let record = await this.subspace.range(ctx, Locations.subscriber.subscription(subscriber, feed));

        let from: { state: Buffer, seq: number } | null = null;
        let to: { state: Buffer, seq: number } | null = null;
        let state: {
            generation: number,
            mode: 'async' | 'direct',
            forwardOnly: boolean,
            subscribed: boolean
        } | null = null;

        for (let r of record) {
            let tuple = encoders.tuple.unpack(r.key);
            if (tuple[tuple.length - 1] === 0) {
                if (state) {
                    throw Error('Invalid state');
                }
                state = unpackDescription(r.value);
            } else if (tuple[tuple.length - 1] === 1) {
                if (!state) {
                    throw Error('Invalid state');
                }
                if (from) {
                    throw Error('Invalid state');
                }
                let val = encoders.tuple.unpack(r.value);
                from = { state: (val[0] as Versionstamp).value, seq: val[1] as number };
            } else if (tuple[tuple.length - 1] === 2) {
                if (!state) {
                    throw Error('Invalid state');
                }
                if (!from) {
                    throw Error('Invalid state');
                }
                if (to) {
                    throw Error('Invalid state');
                }
                let val = encoders.tuple.unpack(r.value);
                to = { state: (val[0] as Versionstamp).value, seq: val[1] as number };
            } else {
                throw Error('Invalid state');
            }
        }

        if (!state || !from) {
            return null;
        }
        return {
            ...state,
            from,
            to
        };
    }

    async getSubscriptionDescriptor(ctx: Context, subscriber: Buffer, feed: Buffer): Promise<SubscriberDescriptor | null> {
        let mode = await this.subspace.get(ctx, Locations.subscriber.subscriptionDescriptor(subscriber, feed));
        if (!mode) {
            return null;
        }
        return unpackDescription(mode);
    }

    async getSubscriptions(ctx: Context, subscriber: Buffer) {
        let all = await this.subspace.range(ctx, Locations.subscriber.subscriptionAll(subscriber));
        let feedSet = new BufferSet();
        let feeds: Buffer[] = [];

        for (let v of all) {
            let key = encoders.tuple.unpack(v.key);
            let feed = key[key.length - 2] as Buffer;
            if (!feedSet.has(feed)) {
                feedSet.add(feed);
                feeds.push(feed);
            }
        }

        return await Promise.all(feeds.map((f) => this.getSubscriptionState(ctx, subscriber, f)));
    }

    //
    // Mutations
    //

    async addSubscription(ctx: Context, subscriber: Buffer, feed: Buffer, mode: 'direct' | 'async', forwardOnly: boolean, seq: number, index: Buffer) {
        let generation = 1;
        let ex = await this.getSubscriptionDescriptor(ctx, subscriber, feed);
        if (ex) {
            // Check if already exist
            if (ex.subscribed) {
                throw Error('Subscription already exist');
            }
            generation = ex.generation + 1;
        }

        // Set mode, start and clear stop
        this.subspace.set(ctx, Locations.subscriber.subscriptionDescriptor(subscriber, feed), packDescription({ generation, mode, forwardOnly, subscribed: true }));
        this.subspace.setTupleValue(ctx, Locations.subscriber.subscriptionStart(subscriber, feed), [new VersionstampRef(index), seq]);
        this.subspace.clear(ctx, Locations.subscriber.subscriptionStop(subscriber, feed));

        // Update counters
        this.subspace.add(ctx, Locations.feed.counterTotal(feed), PLUS_ONE);
        if (mode === 'direct') {
            this.subspace.add(ctx, Locations.feed.counterDirect(feed), PLUS_ONE);
        }
        if (mode === 'async') {
            this.subspace.add(ctx, Locations.feed.counterAsync(feed), PLUS_ONE);
        }
    }

    async removeSubscription(ctx: Context, subscriber: Buffer, feed: Buffer, seq: number, index: Buffer) {
        let state = await this.getSubscriptionDescriptor(ctx, subscriber, feed);
        if (!state || !state.subscribed) {
            throw Error('Subscription not exist');
        }

        // Write stop
        this.subspace.set(ctx, Locations.subscriber.subscriptionDescriptor(subscriber, feed), packDescription({ ...state, subscribed: true }));
        this.subspace.setTupleValue(ctx, Locations.subscriber.subscriptionStop(subscriber, feed), [new VersionstampRef(index), seq]);

        // Update counter
        this.subspace.add(ctx, Locations.feed.counterTotal(feed), MINUS_ONE);
        if (state.mode === 'async') {
            this.subspace.add(ctx, Locations.feed.counterAsync(feed), MINUS_ONE);
        }
        if (state.mode === 'direct') {
            this.subspace.add(ctx, Locations.feed.counterDirect(feed), MINUS_ONE);
        }

        return state.mode;
    }

    async updateSubscriptionMode(ctx: Context, subscriber: Buffer, feed: Buffer, mode: 'direct' | 'async') {
        let state = await this.getSubscriptionDescriptor(ctx, subscriber, feed);
        if (!state || !state.subscribed) {
            throw Error('Subscription not exist');
        }
        if (state.mode === mode) {
            return;
        }

        // Update mode
        this.subspace.set(ctx, Locations.subscriber.subscriptionDescriptor(subscriber, feed), packDescription({ ...state, mode }));

        if (state.mode === 'async') {
            this.subspace.add(ctx, Locations.feed.counterAsync(feed), MINUS_ONE);
        }
        if (state.mode === 'direct') {
            this.subspace.add(ctx, Locations.feed.counterDirect(feed), MINUS_ONE);
        }
        if (mode === 'direct') {
            this.subspace.add(ctx, Locations.feed.counterDirect(feed), PLUS_ONE);
        }
        if (mode === 'async') {
            this.subspace.add(ctx, Locations.feed.counterAsync(feed), PLUS_ONE);
        }
    }

    //
    // Counters
    //

    async getFeedSubscriptionsCount(ctx: Context, feed: Buffer) {
        let counter = await this.subspace.get(ctx, Locations.feed.counterTotal(feed));
        if (counter) {
            return encoders.int32LE.unpack(counter);
        } else {
            return 0;
        }
    }

    async getFeedDirectSubscriptionsCount(ctx: Context, feed: Buffer) {
        let counter = await this.subspace.get(ctx, Locations.feed.counterDirect(feed));
        if (counter) {
            return encoders.int32LE.unpack(counter);
        } else {
            return 0;
        }
    }

    async getFeedAsyncSubscriptionsCount(ctx: Context, feed: Buffer) {
        let counter = await this.subspace.get(ctx, Locations.feed.counterAsync(feed));
        if (counter) {
            return encoders.int32LE.unpack(counter);
        } else {
            return 0;
        }
    }
}