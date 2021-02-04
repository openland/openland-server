import { SubscriberReceiver } from './../receiver/SubscriberReceiver';
import {
    CommonEvent, commonEventCollapseKey, commonEventSerialize,
    packFeedEvent, unpackFeedEvent,
    UserSubscriptionHandlerEvent, FeedReference, Event, ChatEvent,
    chatEventCollapseKey,
    chatEventSerialize
} from './../Definitions';
import { RegistrationRepository } from './../repo/RegistrationRepository';
import { inTx, withoutTransaction } from '@openland/foundationdb';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { EventsMediator } from './EventsMediator';
import { EventsRepository } from 'openland-module-events/repo/EventsRepository';
import { subsctractBuffer } from 'openland-module-events/utils/substractBuffer';
import { createLogger } from '@openland/log';

const logger = createLogger('events');
export class TypedEventsMediator {

    readonly registry = new RegistrationRepository(Store.EventRegistrationsDirectory);
    readonly events = new EventsMediator(new EventsRepository(Store.EventStorageDirectory), EventBus);

    //
    // User
    //

    async prepareUser(parent: Context, uid: number) {
        await inTx(parent, async (ctx) => {
            await this.createUserSubscriberIfNeeded(ctx, uid);
            await this.createUserCommonFeedIfNeeded(ctx, uid);
        });
    }

    async createUserSubscriberIfNeeded(parent: Context, uid: number) {
        await inTx(parent, async (ctx) => {
            let ex = await this.registry.getUserSubscriber(ctx, uid);
            if (!ex) {
                let subscriber = await this.events.createSubscriber(ctx);
                this.registry.setUserSubscriber(ctx, uid, subscriber);
            }
        });
    }

    async createUserCommonFeedIfNeeded(parent: Context, uid: number) {
        await inTx(parent, async (ctx) => {
            let subscriber = await this.registry.getUserSubscriber(ctx, uid);
            if (!subscriber) {
                throw Error('Subscriber does not exist');
            }
            let ex = await this.registry.getFeed(ctx, { type: 'common', uid });
            if (!ex) {
                let feed = await this.events.createFeed(ctx, 'forward-only');
                await this.events.subscribe(ctx, subscriber, feed);
                this.registry.setFeed(ctx, { type: 'common', uid }, feed);
            }
        });
    }

    //
    // Chat
    //

    async prepareChat(parent: Context, cid: number) {
        await inTx(parent, async (ctx) => {
            await this.createChatFeedIfNeeded(ctx, cid);
        });
    }

    async createChatFeedIfNeeded(parent: Context, cid: number) {
        await inTx(parent, async (ctx) => {
            let ex = await this.registry.getFeed(ctx, { type: 'chat', cid });
            if (!ex) {
                let feed = await this.events.createFeed(ctx, 'generic');
                this.registry.setFeed(ctx, { type: 'chat', cid }, feed);
            }
        });
    }

    async preparePrivateChat(parent: Context, cid: number, uid: number) {
        await inTx(parent, async (ctx) => {
            await this.createPrivateChatFeedIfNeeded(ctx, cid, uid);
            await this.subscribe(ctx, uid, { type: 'chat-private', cid, uid });
        });
    }

    async createPrivateChatFeedIfNeeded(parent: Context, cid: number, uid: number) {
        await inTx(parent, async (ctx) => {
            let ex = await this.registry.getFeed(ctx, { type: 'chat-private', cid, uid });
            if (!ex) {
                let feed = await this.events.createFeed(ctx, 'generic');
                this.registry.setFeed(ctx, { type: 'chat-private', cid, uid }, feed);
            }
        });
    }

    async subscribe(parent: Context, uid: number, feedRef: FeedReference) {
        await inTx(parent, async (ctx) => {
            let subscriber = await this.registry.getUserSubscriber(ctx, uid);
            if (!subscriber) {
                throw Error('Subscriber does not exist');
            }
            let feed = await this.registry.getFeed(ctx, feedRef);
            if (!feed) {
                throw Error('Feed does not exist');
            }

            // Check if already subscribed
            if (await this.events.repo.isSubscribed(ctx, subscriber, feed)) {
                return false;
            }

            // Subscribe
            await this.events.subscribe(ctx, subscriber, feed);

            return true;
        });
    }

    async unsubscribe(parent: Context, uid: number, feedRef: FeedReference) {
        await inTx(parent, async (ctx) => {
            let subscriber = await this.registry.getUserSubscriber(ctx, uid);
            if (!subscriber) {
                throw Error('Subscriber does not exist');
            }
            let feed = await this.registry.getFeed(ctx, feedRef);
            if (!feed) {
                throw Error('Feed does not exist');
            }

            // Check if already subscribed
            if (!(await this.events.repo.isSubscribed(ctx, subscriber, feed))) {
                return false;
            }

            // Subscribe
            await this.events.unsubscribe(ctx, subscriber, feed);

            return true;
        });
    }

    //
    // State
    //

    async getInitialFeeds(parent: Context, uid: number): Promise<FeedReference[]> {
        return await inTx(parent, async (ctx) => {
            let subscriber = await this.registry.getUserSubscriber(ctx, uid);
            if (!subscriber) {
                throw Error('Subscriber does not exist');
            }

            // TODO: Implement initial feeds

            return [{ type: 'common', uid: uid }];
        });
    }

    async getState(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let subscriber = await this.registry.getUserSubscriber(ctx, uid);
            if (!subscriber) {
                throw Error('Subscriber does not exist');
            }
            await this.events.refreshOnline(ctx, subscriber);
            return (await this.events.repo.getState(ctx, subscriber));
        });
    }

    async getCurrentSeq(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let subscriber = await this.registry.getUserSubscriber(ctx, uid);
            if (!subscriber) {
                throw Error('Subscriber does not exist');
            }
            await this.events.refreshOnline(ctx, subscriber);
            return (await this.events.repo.subSeq.getCurrentSeq(ctx, subscriber));
        });
    }

    async getFeedState(parent: Context, feed: FeedReference) {
        return await inTx(parent, async (ctx) => {
            let feedid = await this.registry.getFeed(ctx, feed);
            if (!feedid) {
                throw Error('Feed does not exist');
            }
            let latest = await this.events.repo.feedLatest.readLatest(ctx, feedid);
            return { pts: latest.seq, state: latest.vt.value.toString('base64') };
        });
    }

    async getFeedSubscriberPts(ctx: Context, feed: FeedReference, uid: number) {
        // return await inTx(parent, async (ctx) => {
        let feedid = await this.registry.getFeed(ctx, feed);
        if (!feedid) {
            throw Error('Feed does not exist of ' + JSON.stringify(feed));
        }
        let subscriber = await this.registry.getUserSubscriber(ctx, uid);
        if (!subscriber) {
            throw Error('Subscriber does not exist for ' + uid);
        }

        let substate = await this.events.repo.sub.getSubscriptionState(ctx, subscriber, feedid);
        if (!substate) {
            throw Error('Subscription does not exist for ' + uid + ' of ' + JSON.stringify(feed));
        }
        if (substate.to) {
            return substate.to.seq;
        } else {
            let latest = await this.events.repo.feedLatest.readLatest(ctx, feedid);
            return latest.seq;
        }
        // });
    }

    async getFeedDifference(parent: Context, uid: number, feed: FeedReference, seq: number) {
        return await inTx(parent, async (ctx) => {
            let subscriber = await this.registry.getUserSubscriber(ctx, uid);
            if (!subscriber) {
                throw Error('Subscriber does not exist');
            }
            let feedid = await this.registry.getFeed(ctx, feed);
            if (!feedid) {
                throw Error('Feed does not exist');
            }
            await this.events.refreshOnline(ctx, subscriber);
            let difference = await this.events.repo.getFeedDifference(ctx, subscriber, feedid, seq, { limits: { forwardOnly: 100, generic: 20 } });
            let events: { pts: number, event: Event }[] = [];
            for (let e of difference.events) {
                let update = unpackFeedEvent(e.event);
                events.push({ pts: e.seq, event: update.event });
            }
            return {
                active: difference.active,
                forwardOnly: difference.forwardOnly,
                hasMore: difference.hasMore,
                after: difference.afterSeq,
                events
            };
        });
    }

    async getDifference(parent: Context, uid: number, state: string, strict: boolean = true) {

        // Adjust cursor
        // VTs generated with 10 sec delay
        // <Buffer 00 00 06 75 de 95 ef ae 00 00>
        // <Buffer 00 00 06 75 df 2e a5 dc 00 00>
        // NOTE: Add two more bytes for tx-local part of versionstamp
        const delta = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        const cursor = Buffer.from(state, 'base64');
        const adjusted = strict ? cursor : subsctractBuffer(cursor, delta);
        logger.log(parent, 'Delta: ' + cursor.toString('hex') + ' -> ' + adjusted.toString('hex'));

        return await inTx(parent, async (ctx) => {
            let subscriber = await this.registry.getUserSubscriber(ctx, uid);
            if (!subscriber) {
                throw Error('Subscriber does not exist');
            }
            await this.events.refreshOnline(ctx, subscriber);
            let res = await this.events.repo.getDifference(ctx, subscriber, adjusted, { limits: { forwardOnly: 100, generic: 20, global: 300 } });

            // Parse sequences
            let sequences: { sequence: FeedReference, pts: number, hasMore: boolean, events: { pts: number, event: Event }[] }[] = [];
            for (let f of res.updates) {
                let update = unpackFeedEvent(f.events[0].event);
                let sequence = update.feed;
                sequences.push({
                    sequence,
                    hasMore: f.hasMore,
                    pts: f.afterSeq,
                    events: f.events.map((v) => ({
                        event: unpackFeedEvent(v.event).event,
                        pts: v.seq
                    }))
                });
            }

            return {
                hasMore: res.hasMore,
                seq: res.seq,
                state: res.vt.toString('base64'),
                sequences
            };
        });
    }

    //
    // Posting
    //

    async postToCommon(parent: Context, uid: number, event: CommonEvent) {
        await inTx(parent, async (ctx) => {
            // Load feed
            let feed = await this.registry.getFeed(ctx, { type: 'common', uid });
            if (!feed) {
                throw Error('Feed does not exist');
            }

            // Pack
            let serialized = commonEventSerialize(event);
            let collapseKey = commonEventCollapseKey(event);
            let packed = packFeedEvent({ type: 'common', uid }, serialized);

            // Publish
            await this.events.post(ctx, { feed, event: packed, collapseKey });
        });
    }

    async postToChat(parent: Context, cid: number, event: ChatEvent) {
        await inTx(parent, async (ctx) => {
            // Load feed
            let feed = await this.registry.getFeed(ctx, { type: 'chat', cid });
            if (!feed) {
                throw Error('Feed does not exist');
            }

            // Pack
            let serialized = chatEventSerialize(event);
            let collapseKey = chatEventCollapseKey(event);
            let packed = packFeedEvent({ type: 'chat', cid }, serialized);

            // Publish
            await this.events.post(ctx, { feed, event: packed, collapseKey });
        });
    }

    async postToChatPrivate(parent: Context, cid: number, uid: number, event: ChatEvent) {
        await inTx(parent, async (ctx) => {
            // Load feed
            let feed = await this.registry.getFeed(ctx, { type: 'chat-private', cid, uid });
            if (!feed) {
                throw Error('Feed does not exist');
            }

            // Pack
            let serialized = chatEventSerialize(event);
            let collapseKey = chatEventCollapseKey(event);
            let packed = packFeedEvent({ type: 'chat-private', cid, uid: uid }, serialized);

            // Publish
            await this.events.post(ctx, { feed, event: packed, collapseKey });
        });
    }

    //
    // Receiving
    //

    receive(parent: Context, uid: number, handler: (e: UserSubscriptionHandlerEvent) => void) {

        let closed = false;
        let receiver: SubscriberReceiver | null = null;

        // tslint:disable-next-line:no-floating-promises
        (async () => {
            try {

                // Get subscriber
                let subscriber = await inTx(withoutTransaction(parent), async (ctx) => {
                    return await this.registry.getUserSubscriber(ctx, uid);
                });
                if (!subscriber) {
                    throw Error('Subscriber does not exist');
                }

                // Subscribe
                if (closed) {
                    return;
                }
                receiver = this.events.receive(subscriber, (e) => {
                    if (e.type === 'started') {
                        handler({ type: 'started', state: e.state.toString('base64'), seq: e.seq });
                    } else if (e.type === 'closed') {
                        if (!closed) {
                            closed = true;
                            handler({ type: 'closed' });
                        }
                    } else if (e.type === 'update') {
                        let event = unpackFeedEvent(e.event);
                        handler({ type: 'update', feed: event.feed, seq: e.seq, event: event.event, state: e.state.toString('base64'), pts: e.pts });
                    } else if (e.type === 'update-ephemeral') {
                        let event = unpackFeedEvent(e.event);
                        handler({ type: 'update-ephemeral', feed: event.feed, seq: e.seq, event: event.event });
                    }
                });
            } catch (e) {
                if (!closed) {
                    closed = true;
                    handler({ type: 'closed' });
                }
            }
        })();

        return () => {
            if (!closed) {
                closed = true;
                if (receiver) {
                    receiver.close();
                    receiver = null;
                } else {
                    handler({ type: 'closed' });
                }
            }
        };
    }
}