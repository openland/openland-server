import { FeedReference } from './../Definitions';
import { Context } from '@openland/context';
import { Subspace, encoders } from '@openland/foundationdb';

const SUBSPACE_USER_SUBSCRIBER = 0;
const SUBSPACE_USER_COMMON = 1;

export class RegistrationRepository {
    private readonly subsspace: Subspace;

    constructor(subsspace: Subspace) {
        this.subsspace = subsspace;
    }

    async getUserSubscriber(ctx: Context, uid: number) {
        return await this.subsspace.get(ctx, encoders.tuple.pack([SUBSPACE_USER_SUBSCRIBER, uid]));
    }

    setUserSubscriber(ctx: Context, uid: number, subscriber: Buffer) {
        this.subsspace.set(ctx, encoders.tuple.pack([SUBSPACE_USER_SUBSCRIBER, uid]), subscriber);
    }

    async getFeed(ctx: Context, feed: FeedReference) {
        return await this.subsspace.get(ctx, this.resolveLocaton(feed));
    }

    setFeed(ctx: Context, feed: FeedReference, ref: Buffer) {
        this.subsspace.set(ctx, this.resolveLocaton(feed), ref);
    }

    private resolveLocaton(feed: FeedReference) {
        if (feed.type === 'common') {
            return encoders.tuple.pack([SUBSPACE_USER_COMMON, feed.uid]);
        }
        throw Error('Unknown feed type');
    }
}