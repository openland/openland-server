import { Subspace, inTxLeaky, encoders } from '@openland/foundationdb';
import { EventsStorage } from './EventsStorage';
import { Context } from '@openland/context';

const SUBSPACE_USER = 0;
const USER_SUBSCRIBER = 0;
const USER_COMMON = 1;

const SUBSPACE_GROUP = 0;
const GROUP_FEED = 0;

const SUBSPACE_FEED = 0;
const FEED_COMMON = 0;
const FEED_GROUP = 1;

const SUBSPACE_SUBSCRIBERS = 0;
const SUBSCRIBER_USER = 0;

export class RegistrationsRepository {
    private readonly storage: EventsStorage;
    private readonly directory: Subspace;

    constructor(directory: Subspace, storage: EventsStorage) {
        this.storage = storage;
        this.directory = directory;
    }

    getOrCreateUser = async (parent: Context, uid: number) => {
        return await inTxLeaky(parent, async (ctx) => {
            let [subscriber, common] = await Promise.all([
                this.directory.get(ctx, encoders.tuple.pack([SUBSPACE_USER, uid, USER_SUBSCRIBER])),
                this.directory.get(ctx, encoders.tuple.pack([SUBSPACE_USER, uid, USER_COMMON]))
            ]);

            // Create subscriber if needed
            if (!subscriber) {
                subscriber = await this.storage.createSubscriber(ctx);
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_USER, uid, USER_SUBSCRIBER]), subscriber);
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_SUBSCRIBERS, subscriber]), encoders.tuple.pack([SUBSCRIBER_USER, uid]));
            }

            // Create common feed if needed
            if (!common) {
                common = (await this.storage.createFeed(ctx));
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_USER, uid, USER_COMMON]), common);
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_FEED, common]), encoders.tuple.pack([FEED_COMMON, uid]));
                await this.storage.subscribe(ctx, subscriber, common, { strict: true });
            }

            return { subscriber, common };
        });
    }

    getOrCreateGroup = async (parent: Context, cid: number) => {
        return await inTxLeaky(parent, async (ctx) => {
            let existing = await this.directory.get(ctx, encoders.tuple.pack([SUBSPACE_GROUP, cid, GROUP_FEED]));
            if (!existing) {
                existing = (await this.storage.createFeed(ctx));
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_GROUP, cid, GROUP_FEED]), existing);
                this.directory.set(ctx, encoders.tuple.pack([SUBSPACE_FEED, existing]), encoders.tuple.pack([FEED_GROUP, cid]));
                return existing;
            }
            return existing;
        });
    }

    getFeedSource = async (parent: Context, feed: Buffer): Promise<{ type: 'group', cid: number } | { type: 'common', uid: number } | null> => {
        return await inTxLeaky(parent, async (ctx) => {
            let existing = await this.directory.get(ctx, encoders.tuple.pack([SUBSPACE_FEED, feed]));
            if (!existing) {
                return null;
            }
            let tuple = encoders.tuple.unpack(existing);
            if (tuple[0] === FEED_COMMON) {
                if (typeof tuple[1] !== 'number') {
                    return null;
                }
                return { type: 'common', uid: tuple[1] as number };
            }
            if (tuple[1] === FEED_GROUP) {
                if (typeof tuple[1] !== 'number') {
                    return null;
                }
                return { type: 'group', cid: tuple[1] as number };
            }
            return null;
        });
    }

    getSubscriptionSource = async (parent: Context, subscriber: Buffer): Promise<{ type: 'user', uid: number } | null> => {
        return await inTxLeaky(parent, async (ctx) => {
            let existing = await this.directory.get(ctx, encoders.tuple.pack([SUBSPACE_SUBSCRIBERS, subscriber]));
            if (!existing) {
                return null;
            }
            let tuple = encoders.tuple.unpack(existing);
            if (tuple[0] === SUBSCRIBER_USER) {
                if (typeof tuple[1] !== 'number') {
                    return null;
                }
                return { type: 'user', uid: tuple[1] as number };
            }
            return null;
        });
    }

    followGroup = async (parent: Context, args: { uid: number, cid: number }) => {
        await inTxLeaky(parent, async (ctx) => {
            let user = await this.getOrCreateUser(ctx, args.uid);
            let group = await this.getOrCreateGroup(ctx, args.cid);
            await this.storage.subscribe(ctx, user.subscriber, group);
        });
    }

    unfollowGroup = async (parent: Context, args: { uid: number, cid: number }) => {
        await inTxLeaky(parent, async (ctx) => {
            let user = await this.getOrCreateUser(ctx, args.uid);
            let group = await this.getOrCreateGroup(ctx, args.cid);
            await this.storage.unsubscribe(ctx, user.subscriber, group);
        });
    }
}