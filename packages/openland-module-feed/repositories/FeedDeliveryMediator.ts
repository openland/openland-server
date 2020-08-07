import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';
import { injectable } from 'inversify';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { getTransaction, inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import {
    FeedEvent,
    FeedItemDeletedEvent,
    FeedItemReceivedEvent,
    FeedItemUpdatedEvent, FeedRebuildEvent
} from '../../openland-module-db/store';
import { batch } from '../../openland-utils/batch';

@injectable()
export class FeedDeliveryMediator {
    private readonly queue = new BetterWorkerQueue<{ itemId: number, action?: 'new' | 'update' | 'delete' }>(Store.FeedDeliveryQueue, { type: 'transactional', maxAttempts: 'infinite' });
    private readonly queueUserMultiple = new BetterWorkerQueue<{ itemId: number, subscriberIds: number[], action?: 'new' | 'update' | 'delete' }>(Store.FeedDeliveryMultipleQueue, { type: 'transactional', maxAttempts: 'infinite' });

    start = () => {
        if (serverRoleEnabled('delivery')) {
            this.queue.addWorkers(100, async (parent, item) => {
                if (item.action === 'new' || item.action === undefined) {
                    await this.fanOutDelivery(parent, item.itemId, 'new');
                } else if (item.action === 'delete') {
                    await this.fanOutDelivery(parent, item.itemId, 'delete');
                } else if (item.action === 'update') {
                    await this.fanOutDelivery(parent, item.itemId, 'update');
                } else {
                    throw Error('Unknown action: ' + item.action);
                }
            });
            this.queueUserMultiple.addWorkers(100, async (parent, item) => {
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
            });
        }
    }

    onNewItem = async (root: Context, item: FeedEvent) => {
        await inTx(root, async ctx => {
            await this.queue.pushWork(ctx, { itemId: item.id, action: 'new' });
        });
    }

    onItemUpdated = async (root: Context, item: FeedEvent) => {
        await inTx(root, async ctx => {
            await this.queue.pushWork(ctx, { itemId: item.id, action: 'update' });
        });
    }

    onItemDeleted = async (root: Context, item: FeedEvent) => {
        await inTx(root, async ctx => {
            await this.queue.pushWork(ctx, { itemId: item.id, action: 'delete' });
        });
    }

    onFeedRebuildNeeded = async (root: Context, subscriberId: number) => {
        await inTx(root, async ctx => {
            Store.FeedEventStore.post(ctx, subscriberId, FeedRebuildEvent.create({ subscriberId }));
        });
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
                    subscriberIds: b,
                    action
                }));
                await Promise.all(tasks);
            }
        });
    }

    private deliverItemToUser = async (ctx: Context, sid: number, item: FeedEvent) => {
        Store.FeedEventStore.post(ctx, sid, FeedItemReceivedEvent.create({ subscriberId: sid, itemId: item.id }));
    }

    private deliverItemUpdatedToUser = async (ctx: Context, sid: number, item: FeedEvent) => {
        Store.FeedEventStore.post(ctx, sid, FeedItemUpdatedEvent.create({ subscriberId: sid, itemId: item.id }));
    }

    private deliverItemDeletedToUser = async (ctx: Context, sid: number, item: FeedEvent) => {
        Store.FeedEventStore.post(ctx, sid, FeedItemDeletedEvent.create({ subscriberId: sid, itemId: item.id }));
    }
}