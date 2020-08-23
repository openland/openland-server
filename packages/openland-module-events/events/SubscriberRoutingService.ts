import { inTx } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';
import { Modules } from 'openland-modules/Modules';
import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';

const root = createNamedContext('events-service');

export class SubscriberRoutingService {

    private subscriber: Buffer;
    private subscriberSubscription!: EventBusSubcription;

    constructor(subscriber: Buffer) {
        this.subscriber = subscriber;
    }

    async start() {
        let initial = await inTx(root, async (ctx) => {
            let subscriptions = await Modules.Events.mediator.storage.getSubscriberState(ctx, this.subscriber);
            let version = await Modules.Events.mediator.storage.getSubscriberVersion(ctx, this.subscriber);
            let watch = await Modules.Events.mediator.storage.watchSubscriberVersion(ctx, this.subscriber);
            return { subscriptions, version, watch };
        });

        this.subscriberSubscription = EventBus.subscribe(`events.subscriber.`, (data) => {
            let feedId = Buffer.from(data.feedId as string, 'hex');
            let postId = Buffer.from(data.postId as string, 'hex');
            let seq = data.seq as number;
            this.handleUpdate(feedId, postId, seq);
        });

        this.applySubscriptions(initial.subscriptions);
    }

    private handleUpdate = (feedId: Buffer, postId: Buffer, seq: number) => {
        // TODO: Implement
    }

    private applySubscriptions = (subscriptions: { id: Buffer, joined: Buffer, latest: Buffer | null, jumbo: boolean }[]) => {
        // TODO: Implement
    }

    async stop() {
        this.subscriberSubscription.cancel();
        this.applySubscriptions([]);
    }
}