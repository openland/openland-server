import { backoff, AsyncLock } from 'openland-utils/timer';
import { inTx, encoders } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';
import { Modules } from 'openland-modules/Modules';
import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { startAsyncInterval } from 'openland-utils/startAsyncInterval';
import { createStateLost, createCheckpoint } from './wire';

const root = createNamedContext('events-service');

const REFRESH_TIMEOUT = 15 * 60 * 1000; /* 15 min */
const REFRESH_INTERVAL = 60 * 1000; /* 1 min */
const SEQ_GAP = 1000;

export class SubscriberRoutingService {

    private subscriber: Buffer;
    private subscriberId: string;
    private subscriberSubscription: EventBusSubcription | null = null;
    private refresh: (() => Promise<void>) | null = null;
    private syncRefresh: (() => Promise<void>) | null = null;
    private subscriptions = new Map<string, { seq: number, subscription: EventBusSubcription }>();
    private lock = new AsyncLock();

    constructor(subscriber: Buffer) {
        this.subscriber = subscriber;
        this.subscriberId = this.subscriber.toString('hex');
    }

    async start() {
        let initial = await inTx(root, async (ctx) => {

            // Jumbo subscriptions
            let jumboSubscriptions = await Modules.Events.mediator.storage.getSubscriberJumboSubscriptions(ctx, this.subscriber);
            let jumbo = await Promise.all(jumboSubscriptions.map(async (feed) => {
                return {
                    feed,
                    seq: await Modules.Events.mediator.storage.getFeedSeq(ctx, feed)
                };
            }));

            // Subscriber versions
            let version = await Modules.Events.mediator.storage.getSubscriberVersion(ctx, this.subscriber);
            let watch = await Modules.Events.mediator.storage.watchSubscriberVersion(ctx, this.subscriber);

            // Refresh online
            await Modules.Events.mediator.seqRepository.refreshOnline(ctx, this.subscriber, Date.now() + REFRESH_TIMEOUT);

            // State
            let statePromise = (await Modules.Events.mediator.storage.getStateTransactional(ctx, this.subscriber)).promise;

            // State seq
            await Modules.Events.mediator.seqRepository.allocateBlock(ctx, this.subscriber, SEQ_GAP);
            let seqStateLost = await Modules.Events.mediator.seqRepository.allocateSeq(ctx, this.subscriber);
            let seqCheckpoint = await Modules.Events.mediator.seqRepository.allocateSeq(ctx, this.subscriber);

            return { jumbo, version, watch, statePromise, seqStateLost, seqCheckpoint };
        });

        // Resolve state
        let state = await initial.statePromise;

        // Apply jumbo subscriptions
        await this.applyJumboSubsciptions(initial.jumbo, state, initial.seqCheckpoint);

        // Start refresh interval
        this.refresh = startAsyncInterval(async () => {
            await backoff(root, async () => {
                await inTx(root, async (ctx) => {
                    await Modules.Events.mediator.seqRepository.refreshOnline(ctx, this.subscriber, Date.now() + REFRESH_TIMEOUT);
                });
            });
        }, REFRESH_INTERVAL);

        // Start checkpoint interval
        this.syncRefresh = startAsyncInterval(async () => {
            await this.lock.inLock(async () => {
                let jumbo = await inTx(root, async (ctx) => {
                    let jumboSubscriptions = await Modules.Events.mediator.storage.getSubscriberJumboSubscriptions(ctx, this.subscriber);
                    let statePromise = (await Modules.Events.mediator.storage.getStateTransactional(ctx, this.subscriber)).promise;
                    let seq = await Modules.Events.mediator.seqRepository.allocateSeq(ctx, this.subscriber);
                    return {
                        jumbo: await Promise.all(jumboSubscriptions.map(async (feed) => {
                            return {
                                feed,
                                seq: await Modules.Events.mediator.storage.getFeedSeq(ctx, feed)
                            };
                        })),
                        statePromise,
                        seq
                    };
                });

                await this.applyJumboSubsciptions(jumbo.jumbo, await jumbo.statePromise, jumbo.seq);
            });
        }, REFRESH_INTERVAL);

        // Send StateLost message
        EventBus.publish(`events.subscriber.${this.subscriberId}`, createStateLost(initial.seqStateLost, state));
    }

    //
    // Handle updates
    //

    private handleUpdate = (feed: Buffer, seq: number, id: Buffer) => {
        // tslint:disable-next-line:no-floating-promises
        this.lock.inLock(async () => {
            await inTx(root, async (ctx) => {
                let targetSeq = await Modules.Events.mediator.seqRepository.allocateSeq(ctx, this.subscriber);
                let body = encoders.tuple.pack([1, targetSeq, feed, seq, id]);
                EventBus.publish(`events.subscriber.${this.subscriberId}`, body.toString('hex'));
            });
        });
    }

    //
    // Jumbo Subscriptions
    //

    private addSubscription = (feed: Buffer, seq: number) => {
        let feedId = feed.toString('hex');
        let subscription = EventBus.subscribe(`events.feed.${feedId}`, (src) => {
            let body = Buffer.from((src as string), 'hex');
            let tuple = encoders.tuple.unpack(body);
            if (tuple[0] !== 1) {
                return;
            }
            let s = tuple[1] as number;
            let id = tuple[2] as Buffer;
            this.handleUpdate(feed, s, id);
        });
        this.subscriptions.set(feed.toString('hex'), { seq, subscription });
    }

    private removeSubscription = (feed: Buffer) => {
        let feedId = feed.toString('hex');
        let ex = this.subscriptions.get(feedId);
        if (ex) {
            ex.subscription.cancel();
            this.subscriptions.delete(feedId);
        }
    }

    private updateSubscriptions = (feed: Buffer, seq: number) => {
        // TODO: Handle
    }

    private applyJumboSubsciptions = async (subscriptions: { feed: Buffer, seq: number }[], state: Buffer, seq: number) => {

        // Add missing
        for (let s of subscriptions) {
            let feedId = s.feed.toString('hex');
            if (!this.subscriptions.has(feedId)) {
                this.addSubscription(s.feed, s.seq);
            } else {
                this.updateSubscriptions(s.feed, s.seq);
            }
        }

        // Remove removed
        for (let key of [...this.subscriptions.keys()]) {
            if (!subscriptions.find((v) => v.feed.toString('hex') !== key)) {
                this.removeSubscription(Buffer.from(key, 'hex'));
            }
        }

        // Post checkpoint
        EventBus.publish(`events.subscriber.${this.subscriberId}`, createCheckpoint(seq, state));
    }

    private stopJumboSubscriptions = async () => {
        for (let key of [...this.subscriptions.keys()]) {
            this.removeSubscription(Buffer.from(key, 'hex'));
        }
    }

    //
    // Closing
    //

    async stop() {

        // Stop online refresh
        if (this.refresh) {
            await this.refresh();
            this.refresh = null;
        }

        // Stop sync refresh
        if (this.syncRefresh) {
            await this.syncRefresh();
            this.syncRefresh = null;
        }

        // Stop subscription
        if (this.subscriberSubscription) {
            this.subscriberSubscription.cancel();
            this.subscriberSubscription = null;
        }

        // Stop jumbo subscrioptions
        await this.stopJumboSubscriptions();
    }
}