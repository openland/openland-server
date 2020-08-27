import { EventBus } from './../../openland-module-pubsub/EventBus';
import { EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { AsyncLock } from 'openland-utils/timer';
import { FeedTracker } from './FeedTracker';
import { EventsStorage } from './../repo/EventsStorage';
import { encoders } from '@openland/foundationdb';

export class FeedWatcherCollection {
    readonly subscriber: Buffer;
    private stopped = false;
    private trackers = new Map<string, FeedTracker>();
    private subscriptions = new Map<string, EventBusSubcription>();
    private lock = new AsyncLock();

    constructor(subscriber: Buffer, storage: EventsStorage) {
        this.subscriber = subscriber;
    }

    private handleUpdate = (feed: Buffer, seq: number, id: Buffer, update: Buffer) => {
        // for (let feed of feeds) {
        //     let feedId = feed.id.toString('hex');
        //     this.trackers.set(feedId, new FeedTracker(feed.id, feed.seq, feed.state, storage));
        //     this.subscriptions.set(feedId, EventBus.subscribe(`events.feed.${feedId}`, (src) => {
        //         let body = Buffer.from((src as string), 'hex');
        //         let tuple = encoders.tuple.unpack(body);
        //         if (tuple[0] !== 1) {
        //             return;
        //         }
        //         let seq = tuple[1] as number;
        //         let id = tuple[2] as Buffer;
        //         let update = tuple[3] as Buffer;
        //         this.handleUpdate(feed.id, seq, id, update);
        //     }));
        // }
    }

    async updateFeeds(feeds: { id: Buffer, seq: number, state: Buffer }[]) {
        await this.lock.inLock(() => {
            if (this.stopped) {
                return;
            }

            // TODO: Handle
        });
    }

    async synchronize() {
        await this.lock.inLock(() => {
            if (this.stopped) {
                return;
            }

            // TODO: Handle
        });
    }

    async close() {
        await this.lock.inLock(() => {
            this.stopped = true;
            // TODO: Unsubscribe
        });
    }
}