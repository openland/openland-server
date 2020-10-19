import { FeedReference } from './../Definitions';
import { Context } from '@openland/context';
import { Subspace, encoders } from '@openland/foundationdb';

const SUBSPACE_USER_SUBSCRIBER = 0;
const SUBSPACE_USER_COMMON = 1;
const FEED_FORWARD = 2;
const FEED_BACKWARD = 3;
export class RegistrationRepository {
    private readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    async getUserSubscriber(ctx: Context, uid: number) {
        return await this.subspace.get(ctx, encoders.tuple.pack([SUBSPACE_USER_SUBSCRIBER, uid]));
    }

    setUserSubscriber(ctx: Context, uid: number, subscriber: Buffer) {
        this.subspace.set(ctx, encoders.tuple.pack([SUBSPACE_USER_SUBSCRIBER, uid]), subscriber);
    }

    async getFeed(ctx: Context, feed: FeedReference) {
        return await this.subspace.get(ctx, encoders.tuple.pack([FEED_FORWARD, this.resolveLocaton(feed)]));
    }

    async getFeedRaw(ctx: Context, feed: Buffer) {
        let res = await this.subspace.get(ctx, encoders.tuple.pack([FEED_BACKWARD, feed]));
        if (res) {
            return this.parseLocation(res);
        } else {
            throw Error('Unable to find feed');
        }
    }

    setFeed(ctx: Context, feed: FeedReference, ref: Buffer) {
        let loc = this.resolveLocaton(feed);
        this.subspace.set(ctx, encoders.tuple.pack([FEED_FORWARD, loc]), ref);
        this.subspace.set(ctx, encoders.tuple.pack([FEED_BACKWARD, ref]), loc);
    }

    private resolveLocaton(feed: FeedReference) {
        if (feed.type === 'common') {
            return encoders.tuple.pack([SUBSPACE_USER_COMMON, feed.uid]);
        }
        throw Error('Unknown feed type');
    }

    private parseLocation(src: Buffer): FeedReference {
        let tuple = encoders.tuple.unpack(src);
        if (tuple[0] === SUBSPACE_USER_COMMON) {
            if (typeof tuple[1] !== 'number') {
                throw Error('Unknown feed type');
            }
            return { type: 'common', uid: tuple[1] as number };
        }
        throw Error('Unknown feed type');
    }
}