import { getTransaction, inTx } from '@openland/foundationdb';
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
import { TransWorkerQueue } from 'openland-module-workers/TransWorkerQueue';
import { Metrics } from '../../openland-module-monitoring/Metrics';

const tracer = createTracer('message-delivery');
// const deliveryInitialMetric = createMetric('delivery-fan-out', 'average');
// const deliveryMetric = createMetric('delivery-user-multiple', 'average');
const log = createLogger('delivery');

@injectable()
export class DeliveryMediator {

    // New Queue
    readonly newQeue = new TransWorkerQueue<{ messageId: number, action?: 'new' | 'update' | 'delete' }>('message-delivery', Store.MessageDeliveryDirectory);
    readonly newQueueUserMultiple = new TransWorkerQueue<{ messageId: number, uids: number[], action?: 'new' | 'update' | 'delete' }>('message-delivery-batch', Store.MessageDeliveryBatchDirectory);

    // Obsolete
    private readonly deliverCallStateChangedQueue = new WorkQueue<{ cid: number, hasActiveCall: boolean }>('deliver-call-state-changed');

    @lazyInject('DeliveryRepository') private readonly repo!: DeliveryRepository;
    @lazyInject('CountersMediator') private readonly counters!: CountersMediator;
    @lazyInject('RoomMediator') private readonly room!: RoomMediator;
    @lazyInject('NeedNotificationDeliveryRepository') private readonly needNotification!: NeedNotificationDeliveryRepository;

    start = () => {
        if (serverRoleEnabled('delivery')) {

            // Fan Out Delivery
            this.newQeue.addWorkers(100, async (ctx, item) => {
                if (item.action === 'new' || item.action === undefined) {
                    await this.fanOutDelivery(ctx, item.messageId, 'new');
                } else if (item.action === 'delete') {
                    await this.fanOutDelivery(ctx, item.messageId, 'delete');
                } else if (item.action === 'update') {
                    await this.fanOutDelivery(ctx, item.messageId, 'update');
                } else {
                    throw Error('Unknown action: ' + item.action);
                }
            });

            // User Delivery
            this.newQueueUserMultiple.addWorkers(1000, async (ctx, item) => {
                Metrics.DeliveryAttemptFrequence.inc(item.action || 'unknown');

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

                getTransaction(ctx).afterCommit(() => {
                   Metrics.DeliverySuccessFrequence.inc(item.action || 'unknown');
                });
            });

            this.deliverCallStateChangedQueue.addWorker(async (item, parent) => {
                await inTx(parent, async ctx => {
                    let members = await Modules.Messaging.room.findConversationMembers(ctx, item.cid);
                    for (let m of members) {
                        await this.repo.deliverCallStateChangedToUser(ctx, m, item.cid, item.hasActiveCall);
                    }
                });
            });
        }
    }

    //
    // Chat Events
    //

    onNewMessage = async (ctx: Context, message: Message) => {
        if (await this.room.isSuperGroup(ctx, message.cid)) {
            this.newQeue.pushWork(ctx, { messageId: message.id, action: 'new' });
        } else {
            let members = await this.room.findConversationMembers(ctx, message.cid);
            await Promise.all(members.map((uid) => this.deliverMessageToUser(ctx, uid, message)));
        }
    }

    onUpdateMessage = async (ctx: Context, message: Message) => {
        if (await this.room.isSuperGroup(ctx, message.cid)) {
            this.newQeue.pushWork(ctx, { messageId: message.id, action: 'update' });
        } else {
            let members = await this.room.findConversationMembers(ctx, message.cid);
            await Promise.all(members.map((uid) => this.deliverMessageUpdateToUser(ctx, uid, message)));
        }
    }

    onDeleteMessage = async (ctx: Context, message: Message) => {
        if (await this.room.isSuperGroup(ctx, message.cid)) {
            this.newQeue.pushWork(ctx, { messageId: message.id, action: 'delete' });
        } else {
            let members = await this.room.findConversationMembers(ctx, message.cid);
            await Promise.all(members.map((uid) => this.deliverMessageDeleteToUser(ctx, uid, message)));
        }
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

    onDialogGotAccess = async (parent: Context, uid: number, cid: number) => {
        await inTx(parent, async (ctx) => {
            await this.repo.deliverDialogGotAccessToUser(ctx, uid, cid);
        });
    }

    onDialogLostAccess = async (parent: Context, uid: number, cid: number) => {
        await inTx(parent, async (ctx) => {
            await this.repo.deliverDialogGotAccessToUser(ctx, uid, cid);
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
            await this.deliverCallStateChangedQueue.pushWork(ctx, { cid, hasActiveCall });
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
                    for (let b of batches) {
                        this.newQueueUserMultiple.pushWork(ctx, {
                            messageId: mid,
                            uids: b,
                            action
                        });
                    }
                    // let tasks = batches.map(b => this.queueUserMultiple.pushWork(ctx, {
                    //     messageId: mid,
                    //     uids: b,
                    //     action
                    // }));
                    // await Promise.all(tasks);
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
