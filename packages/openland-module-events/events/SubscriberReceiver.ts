import { AsyncLock } from './../../openland-utils/timer';
import { Event, parseEvent } from './../Definitions';
import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { inTx, encoders } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { EventsRepository } from '../repo/EventsRepository';

export interface SubscriberReceiverListener {
    onStarted(state: Buffer): void;
    onCheckpoint(state: Buffer): void;
    onEvents(events: { feed: Buffer, event: Event }[]): void;
}

export class SubscriberReceiver {

    readonly repo: EventsRepository;
    readonly subscriber: Buffer;
    private readonly listener: SubscriberReceiverListener;
    private readonly subscriberKey: string;

    private lock = new AsyncLock();
    private started = false;
    private stopped = false;

    // Subscriptions
    private subscriberSubscription: EventBusSubcription | null = null;
    private feedSubscriptions = new Map<string, EventBusSubcription>();

    // Checkpoints
    private lastCheckpoint!: Buffer;
    private lastDirectCheckpoint!: Buffer;
    private directValidatedSeq!: number;
    private directPending = new Map<number, { feed: Buffer, event: Event }>();

    constructor(subscriber: Buffer, repo: EventsRepository, listener: SubscriberReceiverListener) {
        this.listener = listener;
        this.repo = repo;
        this.subscriber = subscriber;
        this.subscriberKey = subscriber.toString('hex');
    }

    start(parent: Context) {
        if (this.started) {
            throw Error('Already started');
        }
        this.started = true;
        // tslint:disable-next-line:no-floating-promises
        this.lock.inLock(async () => {
            await this._start(parent);
        });
    }

    private async _start(parent: Context) {

        //
        // Read all async feeds, current subscriber seq number and initial state
        //

        let init = await inTx(parent, async (ctx) => {
            let asyncFeeds = await this.repo.getAsyncFeeds(ctx, this.subscriber);
            let asyncFeedsWatch = await this.repo.watchAsyncFeeds(ctx, this.subscriber);
            let seq = await this.repo.getSubscriberSeq(ctx, this.subscriber);
            let initState = await this.repo.getState(ctx, this.subscriber);

            // Refresh subscriber online
            await this.repo.refreshSubscriberOnline(ctx, this.subscriber, Date.now() + 15000);

            return {
                seq, asyncFeeds, asyncFeedsWatch, state: initState.state
            };
        });

        //
        // Save initial checkpoints
        //

        let state = await init.state;
        this.lastCheckpoint = state;
        this.lastDirectCheckpoint = state;
        this.directValidatedSeq = init.seq;

        //
        // Notify about initial state
        //

        this.listener.onStarted(state);

        //
        // Subscribe to direct subscription
        //

        this.subscriberSubscription = EventBus.subscribe(`events.subscriber.${this.subscriberKey}`, (data) => {
            let msg = encoders.tuple.unpack(Buffer.from(data as string, 'hex'));
            if (msg[0] === 1 /* Event */) {
                let seq = msg[1] as number;
                let feed = msg[2] as Buffer;
                let fseq = msg[3] as number;
                let body = msg[4] as Buffer;
                let parsed = parseEvent(body);
                // tslint:disable-next-line:no-floating-promises
                this.lock.inLock(async () => {
                    if (this.stopped) {
                        return;
                    }
                    await this.receiveSubscriberUpdate(seq, feed, fseq, parsed);
                });
            }
        });

        //
        // Subscribe to async feeds
        //

        for (let feed of init.asyncFeeds) {
            this.subscribeForFeed(feed.id);
        }
    }

    private subscribeForFeed = (feed: Buffer) => {
        let feedKey = feed.toString('hex');
        this.feedSubscriptions.set(feedKey, EventBus.subscribe(`events.feed.${feedKey}`, (data) => {
            let msg = encoders.tuple.unpack(Buffer.from(data as string, 'hex'));
            if (msg[0] === 1 /* Event */) {
                let fseq = msg[1] as number;
                let body = msg[2] as Buffer;
                let parsed = parseEvent(body);
                // tslint:disable-next-line:no-floating-promises
                this.lock.inLock(async () => {
                    if (this.stopped) {
                        return;
                    }
                    await this.receiveFeedUpdate(feed, fseq, parsed);
                });
            }
        }));
    }

    //
    // Handle updates
    //

    private receiveSubscriberUpdate = async (seq: number, feed: Buffer, fseq: number, event: Event) => {
        // Ignore too old
        if (seq <= this.directValidatedSeq) {
            return;
        }

        // Next update
        let updates: Event[] = [];
        if (this.directValidatedSeq + 1 === seq) {
            this.directValidatedSeq = seq;
            updates.push(event);
            // while(this.directPending.)
        }
    }

    private receiveFeedUpdate = async (feed: Buffer, fseq: number, event: Event) => {
        // TODO: Handle
    }

    //
    // Stop Receiver
    //

    async stop() {
        if (this.stopped) {
            throw Error('Already stopped');
        }
        this.stopped = true;
        await this.lock.inLock(async () => {
            if (this.subscriberSubscription) {
                this.subscriberSubscription.cancel();
                this.subscriberSubscription = null;
            }
            for (let k of this.feedSubscriptions) {
                k[1].cancel();
            }
            this.feedSubscriptions.clear();
        });
    }
}