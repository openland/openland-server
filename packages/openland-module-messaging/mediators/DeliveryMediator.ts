import { inTx, getTransaction } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { createTracer } from 'openland-log/createTracer';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { DeliveryRepository } from 'openland-module-messaging/repositories/DeliveryRepository';
import { Message } from 'openland-module-db/store';
import { lazyInject } from 'openland-modules/Modules.container';
import { CountersMediator } from './CountersMediator';
import { RoomMediator } from './RoomMediator';
import { Context, createNamedContext } from '@openland/context';
import { ImageRef } from 'openland-module-media/ImageRef';
import { batch } from 'openland-utils/batch';
import { NeedNotificationDeliveryRepository } from 'openland-module-messaging/repositories/NeedNotificationDeliveryRepository';
import { Modules } from '../../openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
// import { currentRunningTime } from 'openland-utils/timer';
// import { createMetric } from 'openland-module-monitoring/Metric';
import { createLogger } from '@openland/log';

const tracer = createTracer('message-delivery');
// const deliveryInitialMetric = createMetric('delivery-fan-out', 'average');
// const deliveryMetric = createMetric('delivery-user-multiple', 'average');
const log = createLogger('delivery');

@injectable()
export class DeliveryMediator {
    private readonly queue = new WorkQueue<{ messageId: number, action?: 'new' | 'update' | 'delete' }>('conversation_message_delivery');
    private readonly queueUserMultiple = new WorkQueue<{ messageId: number, uids: number[], action?: 'new' | 'update' | 'delete' }>('conversation_message_delivery_user_multiple');

    @lazyInject('DeliveryRepository') private readonly repo!: DeliveryRepository;
    @lazyInject('CountersMediator') private readonly counters!: CountersMediator;
    @lazyInject('RoomMediator') private readonly room!: RoomMediator;
    @lazyInject('NeedNotificationDeliveryRepository') private readonly needNotification!: NeedNotificationDeliveryRepository;

    start = () => {
        if (serverRoleEnabled('delivery')) {
            for (let i = 0; i < 25; i++) {
                this.queue.addWorker(async (item, parent) => {
                    // const start = currentRunningTime();
                    if (item.action === 'new' || item.action === undefined) {
                        await this.fanOutDelivery(parent, item.messageId, 'new');
                    } else if (item.action === 'delete') {
                        await this.fanOutDelivery(parent, item.messageId, 'delete');
                    } else if (item.action === 'update') {
                        await this.fanOutDelivery(parent, item.messageId, 'update');
                    } else {
                        throw Error('Unknown action: ' + item.action);
                    }
                    // deliveryInitialMetric.add(parent, currentRunningTime() - start);
                });
            }
            for (let i = 0; i < 25; i++) {
                this.queueUserMultiple.addWorker(async (item, parent) => {
                    // const start = currentRunningTime();
                    await tracer.trace(parent, 'deliver-multiple', async (ctx2) => {
                        await inTx(ctx2, async (ctx) => {
                            // Speed up retry loop for lower latency
                            getTransaction(ctx).setOptions({ max_retry_delay: 10 });

                            let message = (await Store.Message.findById(ctx, item.messageId))!;
                            if (item.action === 'new' || item.action === undefined) {
                                await Promise.all(item.uids.map((uid) => this.deliverMessageToUser(ctx, uid, message)));
                            } else if (item.action === 'delete') {
                                await Promise.all(item.uids.map((uid) => this.deliverMessageDeleteToUser(ctx, uid, message)));
                            } else if (item.action === 'update') {
                                await Promise.all(item.uids.map((uid) => this.deliverMessageUpdateToUser(ctx, uid, message)));
                            } else {
                                throw Error('Unknown action: ' + item.action);
                            }
                        });
                    });
                    // deliveryMetric.add(parent, currentRunningTime() - start);
                });
            }
        }
    }

    //
    // Chat Events
    //

    onNewMessage = async (ctx: Context, message: Message) => {
        await this.queue.pushWork(ctx, { messageId: message.id, action: 'new' });
    }

    onUpdateMessage = async (ctx: Context, message: Message) => {
        await this.queue.pushWork(ctx, { messageId: message.id, action: 'update' });
    }

    onDeleteMessage = async (ctx: Context, message: Message) => {
        await this.queue.pushWork(ctx, { messageId: message.id, action: 'delete' });
    }

    onRoomRead = async (parent: Context, uid: number, mid: number) => {
        await inTx(parent, async (ctx) => {
            let message = (await Store.Message.findById(ctx, mid))!;

            // Update counters
            let res = await this.counters.onMessageRead(ctx, uid, message);

            // Update dialogs
            if (res.delta < 0) {
                await this.repo.deliverMessageReadToUser(ctx, uid, mid);
                // Send counter
                await Modules.Push.sendCounterPush(ctx, uid);
            }
        });
    }

    //
    // Dialog updates
    //

    onDialogTitleUpdate = async (parent: Context, cid: number, title: string) => {
        await inTx(parent, async (ctx) => {
            let members = await this.room.findConversationMembers(ctx, cid);
            for (let m of members) {
                await this.repo.deliverDialogTitleUpadtedToUser(ctx, m, cid, title);
                await this.repo.deliverDialogPeerUpdatedToUser(ctx, m, cid);
            }
        });
    }

    onDialogPhotoUpdate = async (parent: Context, cid: number, photo?: ImageRef) => {
        await inTx(parent, async (ctx) => {
            let members = await this.room.findConversationMembers(ctx, cid);
            for (let m of members) {
                await this.repo.deliverDialogPhotoUpadtedToUser(ctx, m, cid, photo);
                await this.repo.deliverDialogPeerUpdatedToUser(ctx, m, cid);
            }
        });
    }

    onUserProfileUpdated = async (parent: Context, uid: number) => {
        return inTx(parent, async ctx => {
            let dialogs = [
                ...(await Store.ConversationPrivate.users.findAll(ctx, uid)),
                ...(await Store.ConversationPrivate.usersReverse.findAll(ctx, uid))
            ];

            log.log(ctx, 'onUserProfileUpdated', dialogs.length);

            let b = batch(dialogs, 10);
            await Promise.all(b.map(d => inTx(createNamedContext('delivery'), async (ctx2) => {
                for (let dialog of d) {
                    let peerUid: number;

                    if (dialog.uid1 === uid) {
                        peerUid = dialog.uid2;
                    } else {
                        peerUid = dialog.uid1;
                    }

                    await this.repo.deliverDialogPeerUpdatedToUser(ctx2, peerUid, dialog.id);
                }
            })));
        });
    }

    onOrganizationProfileUpdated = async (ctx: Context, oid: number) => {
        // Nothing to do
    }

    //
    // Personal Changes
    //

    onDialogDelete = async (parent: Context, uid: number, cid: number) => {
        // Update dialogs
        await inTx(parent, async (ctx) => {
            await this.deliverDialogDeleteToUser(ctx, uid, cid);
        });
    }

    onDialogBump = async (parent: Context, uid: number, cid: number, date: number) => {
        // Update dialogs
        await inTx(parent, async (ctx) => {
            await this.repo.deliverDialogBumpToUser(ctx, uid, cid, date);
        });
    }

    onDialogMuteChanged = async (parent: Context, uid: number, cid: number, mute: boolean) => {
        // Update dialogs
        await inTx(parent, async (ctx) => {
            await this.counters.onDialogMuteChange(ctx, uid, cid);
            await this.repo.deliverDialogMuteChangedToUser(ctx, uid, cid, mute);
        });
    }

    onGlobalCounterTypeChanged = async (parent: Context, uid: number) => {
        // Send new counter
        await inTx(parent, async (ctx) => {
            await this.repo.deliverGlobalCounterToUser(ctx, uid);
            await this.needNotification.setNeedNotificationDelivery(ctx, uid);
        });
    }

    onCallStateChanged = async (parent: Context, cid: number, hasActiveCall: boolean) => {
        await inTx(parent, async ctx => {
            let members = await this.room.findConversationMembers(ctx, cid);
            for (let m of members) {
                await this.repo.deliverCallStateChangedToUser(ctx, m, cid, hasActiveCall);
            }
        });
    }

    //
    // Deliver action to every member of the conversation
    //

    private async fanOutDelivery(parent: Context, mid: number, action: 'new' | 'update' | 'delete') {
        await tracer.trace(parent, 'fanOutDelivery:' + action, async (tctx) => {
            await inTx(tctx, async (ctx) => {
                let message = (await Store.Message.findById(ctx, mid))!;
                let members = await this.room.findConversationMembers(ctx, message.cid);

                // Deliver messages
                if (members.length > 0) {
                    let batches = batch(members, 100);
                    let tasks = batches.map(b => this.queueUserMultiple.pushWork(ctx, {
                        messageId: mid,
                        uids: b,
                        action
                    }));
                    await Promise.all(tasks);
                }
            });
        });
    }

    //
    // User Scoped Delivery
    //

    private deliverMessageToUser = async (ctx: Context, uid: number, message: Message) => {
        // Ignore message hidden for current user
        if (message.hiddenForUids && message.hiddenForUids.includes(uid)) {
            return;
        }
        // Update counters
        await this.counters.onMessageReceived(ctx, uid, message);

        // Update dialogs
        await this.repo.deliverMessageToUser(ctx, uid, message);

        // Mark user as needed notification delivery
        this.needNotification.setNeedNotificationDelivery(ctx, uid);

        // Track message received
        Modules.Metrics.onMessageReceived(ctx, message, uid);
    }

    private deliverMessageUpdateToUser = async (parent: Context, uid: number, message: Message) => {
        await inTx(parent, async (ctx) => {
            // Update dialogs
            await this.repo.deliverMessageUpdateToUser(ctx, uid, message);
        });
    }

    private deliverMessageDeleteToUser = async (parent: Context, uid: number, message: Message) => {
        await inTx(parent, async (ctx) => {

            // Update counters
            await this.counters.onMessageDeleted(ctx, uid, message);

            // Update dialogs
            await this.repo.deliverMessageDeleteToUser(ctx, uid, message);

            // Mark user as needed notification delivery
            this.needNotification.setNeedNotificationDelivery(ctx, uid);

            // Send counter
            await Modules.Push.sendCounterPush(ctx, uid);
        });
    }

    private deliverDialogDeleteToUser = async (parent: Context, uid: number, cid: number) => {
        await inTx(parent, async (ctx) => {

            // Update counters
            await this.counters.onDialogDeleted(ctx, uid, cid);

            // Update dialogs
            await this.repo.deliverDialogDeleteToUser(ctx, uid, cid);

            // Mark user as needed notification delivery
            this.needNotification.setNeedNotificationDelivery(ctx, uid);
            // Send counter
            await Modules.Push.sendCounterPush(ctx, uid);
        });
    }
}
