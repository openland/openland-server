import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { createTracer } from 'openland-log/createTracer';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { DeliveryRepository } from 'openland-module-messaging/repositories/DeliveryRepository';
import { Message, AllEntities } from 'openland-module-db/schema';
import { lazyInject } from 'openland-modules/Modules.container';
import { CountersMediator } from './CountersMediator';
import { RoomMediator } from './RoomMediator';
import { Context } from '@openland/context';
import { ImageRef } from 'openland-module-media/ImageRef';
import { batch } from 'openland-utils/batch';
import { NeedNotificationDeliveryRepository } from 'openland-module-messaging/repositories/NeedNotificationDeliveryRepository';
import { Modules } from '../../openland-modules/Modules';

const tracer = createTracer('message-delivery');

@injectable()
export class DeliveryMediator {
    private readonly queue = new WorkQueue<{ messageId: number, action?: 'new' | 'update' | 'delete' }, { result: string }>('conversation_message_delivery');
    private readonly queueUserMultiple = new WorkQueue<{ messageId: number, uids: number[], action?: 'new' | 'update' | 'delete' }, { result: string }>('conversation_message_delivery_user_multiple');

    @lazyInject('FDB') private readonly entities!: AllEntities;
    @lazyInject('DeliveryRepository') private readonly repo!: DeliveryRepository;
    @lazyInject('CountersMediator') private readonly counters!: CountersMediator;
    @lazyInject('RoomMediator') private readonly room!: RoomMediator;
    @lazyInject('NeedNotificationDeliveryRepository') private readonly needNotification!: NeedNotificationDeliveryRepository;

    start = () => {
        if (serverRoleEnabled('delivery')) {
            for (let i = 0; i < 10; i++) {
                this.queue.addWorker(async (item, parent) => {
                    if (item.action === 'new' || item.action === undefined) {
                        await this.fanOutDelivery(parent, item.messageId, 'new');
                    } else if (item.action === 'delete') {
                        await this.fanOutDelivery(parent, item.messageId, 'delete');
                    } else if (item.action === 'update') {
                        await this.fanOutDelivery(parent, item.messageId, 'update');
                    } else {
                        throw Error('Unknown action: ' + item.action);
                    }
                    return { result: 'ok' };
                });
            }
            for (let i = 0; i < 10; i++) {
                this.queueUserMultiple.addWorker(async (item, parent) => {
                    await tracer.trace(parent, 'deliver-multiple', async (ctx2) => {
                        await inTx(ctx2, async (ctx) => {
                            let message = (await this.entities.Message.findById(ctx, item.messageId))!;
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
                    return { result: 'ok' };
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
            let message = (await this.entities.Message.findById(ctx, mid))!;

            // Update counters
            let res = await this.counters.onMessageRead(ctx, uid, message);

            // Update dialogs
            if (res.delta < 0) {
                await this.repo.deliverMessageReadToUser(ctx, uid, mid);
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
            }
        });
    }

    onDialogPhotoUpdate = async (parent: Context, cid: number, photo?: ImageRef) => {
        await inTx(parent, async (ctx) => {
            let members = await this.room.findConversationMembers(ctx, cid);
            for (let m of members) {
                await this.repo.deliverDialogPhotoUpadtedToUser(ctx, m, cid, photo);
            }
        });
    }

    onUserProfileUpdated = async (ctx: Context, uid: number) => {
        // TODO: Load all dialogs with user
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
            await this.repo.deliverDialogMuteChangedToUser(ctx, uid, cid, mute);
        });
    }

    //
    // Deliver action to every member of the conversation
    //

    private async fanOutDelivery(parent: Context, mid: number, action: 'new' | 'update' | 'delete') {
        await tracer.trace(parent, 'fanOutDelivery:' + action, async (tctx) => {
            await inTx(tctx, async (ctx) => {
                let message = (await this.entities.Message.findById(ctx, mid))!;
                let members = await this.room.findConversationMembers(ctx, message.cid);

                // Deliver messages
                if (members.length > 0) {
                    let batches = batch(members, 10);
                    for (let b of batches) {
                        await this.queueUserMultiple.pushWork(ctx, { messageId: mid, uids: b, action });
                    }
                }
            });
        });
    }

    //
    // User Scoped Delivery
    //

    private deliverMessageToUser = async (parent: Context, uid: number, message: Message) => {
        await tracer.trace(parent, 'deliverMessageToUser', async (tctx) => {
            await inTx(tctx, async (ctx) => {

                // Update counters
                await this.counters.onMessageReceived(ctx, uid, message);

                // Update dialogs
                await this.repo.deliverMessageToUser(ctx, uid, message);

                // Mark user as needed notification delivery
                this.needNotification.setNeedNotificationDelivery(ctx, uid);

                // Track message received
                await Modules.Metrics.onMessageReceived(ctx, message, uid);
            });
        });
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