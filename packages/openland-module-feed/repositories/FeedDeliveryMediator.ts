import { injectable } from 'inversify';
import { WorkQueue } from '../../openland-module-workers/WorkQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getTransaction, inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import {
    FeedEvent,
    FeedItemDeletedEvent,
    FeedItemReceivedEvent,
    FeedItemUpdatedEvent
} from '../../openland-module-db/store';
import { batch } from '../../openland-utils/batch';

@injectable()
export class FeedDeliveryMediator {
    private readonly queue = new WorkQueue<{ itemId: number, action?: 'new' | 'update' | 'delete' }, { result: string }>('feed_item_delivery');
    private readonly queueUserMultiple = new WorkQueue<{ itemId: number, subscriberIds: number[], action?: 'new' | 'update' | 'delete' }, { result: string }>('feed_item_delivery_user_multiple');

    start = () => {
        if (serverRoleEnabled('delivery')) {
            for (let i = 0; i < 25; i++) {
                this.queue.addWorker(async (item, parent) => {
                    if (item.action === 'new' || item.action === undefined) {
                        await this.fanOutDelivery(parent, item.itemId, 'new');
                    } else if (item.action === 'delete') {
                        await this.fanOutDelivery(parent, item.itemId, 'delete');
                    } else if (item.action === 'update') {
                        await this.fanOutDelivery(parent, item.itemId, 'update');
                    } else {
                        throw Error('Unknown action: ' + item.action);
                    }
                    return { result: 'ok' };
                });
            }
            for (let i = 0; i < 25; i++) {
                this.queueUserMultiple.addWorker(async (item, parent) => {
                    await inTx(parent, async (ctx) => {
                        // Speed up retry loop for lower latency
                        getTransaction(ctx).setOptions({ max_retry_delay: 10 });

                        let event = (await Store.FeedEvent.findById(ctx, item.itemId))!;
                        if (item.action === 'new' || item.action === undefined) {
                            await Promise.all(item.subscriberIds.map((sid) => this.deliverItemToUser(ctx, sid, event)));
                        } else if (item.action === 'delete') {
                            await Promise.all(item.subscriberIds.map((sid) => this.deliverItemDeletedToUser(ctx, sid, event)));
                        } else if (item.action === 'update') {
                            await Promise.all(item.subscriberIds.map((sid) => this.deliverItemUpdatedToUser(ctx, sid, event)));
                        } else {
                            throw Error('Unknown action: ' + item.action);
                        }
                    });
                    return { result: 'ok' };
                });
            }
        }
    }

    onNewItem = async (ctx: Context, item: FeedEvent) => {
        await this.queue.pushWork(ctx, { itemId: item.id, action: 'new' });
    }

    onItemUpdated = async (ctx: Context, item: FeedEvent) => {
        await this.queue.pushWork(ctx, { itemId: item.id, action: 'update' });
    }

    onItemDeleted = async (ctx: Context, item: FeedEvent) => {
        await this.queue.pushWork(ctx, { itemId: item.id, action: 'delete' });
    }

    private async fanOutDelivery(parent: Context, itemId: number, action: 'new' | 'update' | 'delete') {
        await inTx(parent, async (ctx) => {
            let event = (await Store.FeedEvent.findById(ctx, itemId))!;
            let subscribers = (await Store.FeedSubscription.topic.findAll(ctx, event.tid)).map(s => s.sid);

            // Deliver
            if (subscribers.length > 0) {
                let batches = batch(subscribers, 20);
                let tasks = batches.map(b => this.queueUserMultiple.pushWork(ctx, {
                    itemId: event.id,
                    subscriberIds: subscribers,
                    action
                }));
                await Promise.all(tasks);
            }
        });
    }

    private deliverItemToUser = async (ctx: Context, sid: number, item: FeedEvent) => {
        await Store.FeedEventStore.post(ctx, sid, FeedItemReceivedEvent.create({ subscriberId: sid, itemId: item.id }));
    }

    private deliverItemUpdatedToUser = async (ctx: Context, sid: number, item: FeedEvent) => {
        await Store.FeedEventStore.post(ctx, sid, FeedItemUpdatedEvent.create({ subscriberId: sid, itemId: item.id }));
    }
    private deliverItemDeletedToUser = async (ctx: Context, sid: number, item: FeedEvent) => {
        await Store.FeedEventStore.post(ctx, sid, FeedItemDeletedEvent.create({ subscriberId: sid, itemId: item.id }));
    }
}