import { BetterWorkerQueue } from './../../openland-module-workers/BetterWorkerQueue';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { createTracer } from 'openland-log/createTracer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { DeliveryRepository } from 'openland-module-messaging/repositories/DeliveryRepository';
import { Message } from 'openland-module-db/store';
import { lazyInject } from 'openland-modules/Modules.container';
import { RoomMediator } from './RoomMediator';
import { Context, createNamedContext } from '@openland/context';
import { ImageRef } from 'openland-module-media/ImageRef';
import { batch } from 'openland-utils/batch';
import { NeedNotificationDeliveryRepository } from 'openland-module-messaging/repositories/NeedNotificationDeliveryRepository';
import { Modules } from '../../openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { createLogger } from '@openland/log';

const tracer = createTracer('message-delivery');
const log = createLogger('delivery');

type DeliveryAction =
    'new' |
    'update' |
    'delete' |
    'call-active' |
    'call-inactive' |
    'voice-chat-active' |
    'voice-chat-inactive' |
    'dialog-title-update' |
    'dialog-peer-update' |
    'dialog-photo-update';

@injectable()
export class DeliveryMediator {

    readonly queueFanOut = new BetterWorkerQueue<{ messageId: number, cid: number, action?: DeliveryAction }>(Store.DeliveryFanOutQueue, {
        maxAttempts: 'infinite',
        type: 'transactional'
    });
    readonly queueUserMultipe = new BetterWorkerQueue<{ messageId: number, cid: number, uids: number[], action?: DeliveryAction }>(Store.DeliveryUserBatchQueue, {
        maxAttempts: 'infinite',
        type: 'transactional'
    });

    @lazyInject('DeliveryRepository') readonly repo!: DeliveryRepository;
    @lazyInject('RoomMediator') private readonly room!: RoomMediator;
    @lazyInject('NeedNotificationDeliveryRepository') private readonly needNotification!: NeedNotificationDeliveryRepository;

    start = () => {
        if (serverRoleEnabled('workers')) {
            this.queueUserMultipe.addWorkers(1000, async (ctx, item) => {
                if (item.action === 'new' || item.action === undefined) {
                    let message = (await Store.Message.findById(ctx, item.messageId))!;
                    for (let uid of item.uids) {
                        this.deliverMessageToUser(ctx, uid, message);
                    }
                } else if (item.action === 'delete') {
                    let message = (await Store.Message.findById(ctx, item.messageId))!;
                    for (let uid of item.uids) {
                        this.deliverMessageDeleteToUser(ctx, uid, message);
                    }
                } else if (item.action === 'update') {
                    let message = (await Store.Message.findById(ctx, item.messageId))!;
                    for (let uid of item.uids) {
                        this.deliverMessageUpdateToUser(ctx, uid, message);
                    }
                } else if (item.action === 'call-active') {
                    for (let uid of item.uids) {
                        this.repo.deliverCallStateChangedToUser(ctx, uid, item.cid, true);
                    }
                } else if (item.action === 'call-inactive') {
                    for (let uid of item.uids) {
                        this.repo.deliverCallStateChangedToUser(ctx, uid, item.cid, false);
                    }
                }  else if (item.action === 'voice-chat-active') {
                    for (let uid of item.uids) {
                        this.repo.deliverVoiceChatStateChangedToUser(ctx, uid, item.cid, true);
                    }
                } else if (item.action === 'voice-chat-inactive') {
                    for (let uid of item.uids) {
                        this.repo.deliverVoiceChatStateChangedToUser(ctx, uid, item.cid, false);
                    }
                } else if (item.action === 'dialog-peer-update') {
                    for (let uid of item.uids) {
                        this.repo.deliverDialogPeerUpdatedToUser(ctx, uid, item.cid);
                    }
                } else if (item.action === 'dialog-photo-update') {
                    for (let uid of item.uids) {
                        this.repo.deliverDialogPhotoUpadtedToUser(ctx, uid, item.cid);
                        this.repo.deliverDialogPeerUpdatedToUser(ctx, uid, item.cid);
                    }
                } else if (item.action === 'dialog-title-update') {
                    let conv = await Store.RoomProfile.findById(ctx, item.cid);
                    for (let uid of item.uids) {
                        this.repo.deliverDialogTitleUpadtedToUser(ctx, uid, item.cid, conv!.title);
                        this.repo.deliverDialogPeerUpdatedToUser(ctx, uid, item.cid);
                    }
                } else {
                    throw Error('Unknown action: ' + item.action);
                }
            });
            this.queueFanOut.addWorkers(100, async (ctx, item) => {
                if (item.action === 'new' || item.action === undefined) {
                    await this.fanOutDelivery(ctx, item.messageId, item.cid, 'new');
                } else if (item.action === 'delete') {
                    await this.fanOutDelivery(ctx, item.messageId, item.cid, 'delete');
                } else if (item.action === 'update') {
                    await this.fanOutDelivery(ctx, item.messageId, item.cid, 'update');
                } else if (item.action === 'call-active') {
                    await this.fanOutDelivery(ctx, item.messageId, item.cid, 'call-active');
                } else if (item.action === 'call-inactive') {
                    await this.fanOutDelivery(ctx, item.messageId, item.cid, 'call-inactive');
                } else if (item.action === 'voice-chat-active') {
                    await this.fanOutDelivery(ctx, item.messageId, item.cid, 'voice-chat-active');
                } else if (item.action === 'voice-chat-inactive') {
                    await this.fanOutDelivery(ctx, item.messageId, item.cid, 'voice-chat-inactive');
                } else if (item.action === 'dialog-peer-update') {
                    await this.fanOutDelivery(ctx, item.messageId, item.cid, 'dialog-peer-update');
                } else if (item.action === 'dialog-title-update') {
                    await this.fanOutDelivery(ctx, item.messageId, item.cid, 'dialog-title-update');
                } else if (item.action === 'dialog-photo-update') {
                    await this.fanOutDelivery(ctx, item.messageId, item.cid, 'dialog-photo-update');
                } else {
                    throw Error('Unknown action: ' + item.action);
                }
            });
        }
    }

    //
    // Chat Events
    //

    onNewMessage = async (ctx: Context, message: Message) => {
        if (await this.room.isSuperGroup(ctx, message.cid)) {
            this.queueFanOut.pushWork(ctx, { messageId: message.id, cid: message.cid, action: 'new' });
        } else {
            let members = await this.room.findConversationMembers(ctx, message.cid);
            for (let member of members) {
                this.deliverMessageToUser(ctx, member, message);
            }
        }
    }

    onUpdateMessage = async (ctx: Context, message: Message) => {
        if (await this.room.isSuperGroup(ctx, message.cid)) {
            this.queueFanOut.pushWork(ctx, { messageId: message.id, cid: message.cid, action: 'update' });
        } else {
            let members = await this.room.findConversationMembers(ctx, message.cid);
            for (let member of members) {
                this.deliverMessageUpdateToUser(ctx, member, message);
            }
        }
    }

    onDeleteMessage = async (ctx: Context, message: Message) => {
        if (await this.room.isSuperGroup(ctx, message.cid)) {
            this.queueFanOut.pushWork(ctx, { messageId: message.id, cid: message.cid, action: 'delete' });
        } else {
            let members = await this.room.findConversationMembers(ctx, message.cid);
            await Promise.all(members.map((uid) => this.deliverMessageDeleteToUser(ctx, uid, message)));
        }
    }

    //
    // Dialog updates
    //

    onDialogTitleUpdate = async (parent: Context, cid: number, title: string) => {
        await inTx(parent, async (ctx) => {
            this.queueFanOut.pushWork(ctx, { messageId: 0, cid, action: 'dialog-title-update' });
        });
    }

    onDialogPhotoUpdate = async (parent: Context, cid: number, photo?: ImageRef) => {
        await inTx(parent, async (ctx) => {
            this.queueFanOut.pushWork(ctx, { messageId: 0, cid, action: 'dialog-photo-update' });
        });
    }

    onDialogPeerUpdate = async (parent: Context, cid: number) => {
        await inTx(parent, async (ctx) => {
            this.queueFanOut.pushWork(ctx, { messageId: 0, cid, action: 'dialog-peer-update' });
        });
    }

    onUserProfileUpdated = async (parent: Context, uid: number) => {
        return inTx(parent, async ctx => {
            let dialogs = [
                ...(await Store.ConversationPrivate.users.findAll(ctx, uid)),
                ...(await Store.ConversationPrivate.usersReverse.findAll(ctx, uid))
            ];

            log.log(ctx, 'onUserProfileUpdated', dialogs.length);

            let b = batch(dialogs, 100);
            await Promise.all(b.map(d => inTx(createNamedContext('delivery'), async (ctx2) => {
                for (let dialog of d) {
                    let peerUid: number;

                    if (dialog.uid1 === uid) {
                        peerUid = dialog.uid2;
                    } else {
                        peerUid = dialog.uid1;
                    }

                    this.repo.deliverDialogPeerUpdatedToUser(ctx2, peerUid, dialog.id);
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
            this.repo.deliverDialogBumpToUser(ctx, uid, cid, date);
            await this.room.notifyRoomUpdatedPersonal(ctx, cid, uid);
        });
    }

    onDialogMuteChanged = async (parent: Context, uid: number, cid: number, mute: boolean) => {
        // Update dialogs
        await inTx(parent, async (ctx) => {
            this.repo.deliverDialogMuteChangedToUser(ctx, uid, cid, mute);
            await this.room.notifyRoomUpdatedPersonal(ctx, cid, uid);
        });
    }

    onDialogGotAccess = async (parent: Context, uid: number, cid: number) => {
        await inTx(parent, async (ctx) => {
            this.repo.deliverDialogGotAccessToUser(ctx, uid, cid);
            await this.room.notifyRoomUpdatedPersonal(ctx, cid, uid);
        });
    }

    onDialogLostAccess = async (parent: Context, uid: number, cid: number) => {
        await inTx(parent, async (ctx) => {
            this.repo.deliverDialogLostAccessToUser(ctx, uid, cid);
            await this.room.notifyRoomUpdatedPersonal(ctx, cid, uid);
        });
    }

    onGlobalCounterTypeChanged = async (parent: Context, uid: number) => {
        // Send new counter
        await inTx(parent, async (ctx) => {
            await this.repo.deliverGlobalCounterToUser(ctx, uid);
            this.needNotification.setNeedNotificationDelivery(ctx, uid);
        });
    }

    onCallStateChanged = async (parent: Context, cid: number, hasActiveCall: boolean) => {
        await inTx(parent, async ctx => {
            if (hasActiveCall) {
                this.queueFanOut.pushWork(ctx, { messageId: 0, cid, action: 'call-active' });
            } else {
                this.queueFanOut.pushWork(ctx, { messageId: 0, cid, action: 'call-inactive' });
            }
            await this.room.notifyRoomUpdated(ctx, cid);
        });
    }

    onVoiceChatStateChanged = async (parent: Context, cid: number, hasActiveVoiceChat: boolean) => {
        await inTx(parent, async ctx => {
            if (hasActiveVoiceChat) {
                this.queueFanOut.pushWork(ctx, { messageId: 0, cid, action: 'voice-chat-active' });
            } else {
                this.queueFanOut.pushWork(ctx, { messageId: 0, cid, action: 'voice-chat-inactive' });
            }
            await this.room.notifyRoomUpdated(ctx, cid);
        });
    }

    //
    // Deliver action to every member of the conversation
    //

    private async fanOutDelivery(parent: Context, mid: number, cid: number, action: DeliveryAction) {
        await tracer.trace(parent, 'fanOutDelivery:' + action, async (tctx) => {
            await inTx(tctx, async (ctx) => {
                let members = await this.room.findConversationMembers(ctx, cid);
                if (members.length > 0) {
                    let batches = batch(members, 20);
                    for (let b of batches) {
                        this.queueUserMultipe.pushWork(ctx, {
                            messageId: mid,
                            cid: cid,
                            uids: b,
                            action
                        });
                    }
                }
            });
        });
    }

    //
    // User Scoped Delivery
    //

    private deliverMessageToUser = (ctx: Context, uid: number, message: Message) => {
        // Ignore message hidden for current user
        if (
            message.visibleOnlyForUids &&
            message.visibleOnlyForUids.length > 0 &&
            !message.visibleOnlyForUids.includes(uid)
        ) {
            return;
        }

        // Update dialogs
        this.repo.deliverMessageToUser(ctx, uid, message);

        // Mark user as needed notification delivery
        this.needNotification.setNeedNotificationDelivery(ctx, uid);
    }

    private deliverMessageUpdateToUser = (ctx: Context, uid: number, message: Message) => {
        this.repo.deliverMessageUpdateToUser(ctx, uid, message);
    }

    private deliverMessageDeleteToUser = (ctx: Context, uid: number, message: Message) => {

        // Update dialogs
        this.repo.deliverMessageDeleteToUser(ctx, uid, message);

        // Mark user as needed notification delivery
        this.needNotification.setNeedNotificationDelivery(ctx, uid);

        // Send counter
        Modules.Push.sendCounterPush(ctx, uid);
    }

    private deliverDialogDeleteToUser = async (parent: Context, uid: number, cid: number) => {
        await inTx(parent, async (ctx) => {

            // Update dialogs
            await this.repo.deliverDialogDeleteToUser(ctx, uid, cid);

            // Mark user as needed notification delivery
            this.needNotification.setNeedNotificationDelivery(ctx, uid);
            // Send counter
            Modules.Push.sendCounterPush(ctx, uid);
        });
    }
}
