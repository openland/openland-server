import { SubscriberReceiver } from './../receiver/SubscriberReceiver';
import { CommonEvent, commonEventCollapseKey, commonEventSerialize, packFeedEvent, unpackFeedEvent, UserSubscriptionHandlerEvent, FeedReference } from './../Definitions';
import { RegistrationRepository } from './../repo/RegistrationRepository';
import { inTx, withoutTransaction } from '@openland/foundationdb';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { EventsMediator } from './EventsMediator';
import { EventsRepository } from 'openland-module-events/repo/EventsRepository';

export class TypedEventsMediator {

    readonly registry = new RegistrationRepository(Store.EventsTestRegistrationsDirectory);
    readonly events = new EventsMediator(new EventsRepository(Store.EventsTestStoreDirectory), EventBus);

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

    async getFeedState(parent: Context, feed: FeedReference) {
        return await inTx(parent, async (ctx) => {
            let feedid = await this.registry.getFeed(ctx, feed);
            if (!feedid) {
                throw Error('Feed does not exist');
            }
            let latest = await this.events.repo.feedLatest.readLatest(ctx, feedid);
            return { pts: latest.seq, state: latest.state.toString('base64') };
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
                    } else if (e.type === 'checkpoint') {
                        handler({ type: 'checkpoint', state: e.state.toString('base64'), seq: e.seq });
                    } else if (e.type === 'closed') {
                        if (!closed) {
                            closed = true;
                            handler({ type: 'closed' });
                        }
                    } else if (e.type === 'update') {
                        let event = unpackFeedEvent(e.event);
                        handler({ type: 'update', feed: event.feed, seq: e.seq, event: event.event, pts: e.pts });
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