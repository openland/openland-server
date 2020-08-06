import { UserDialogsRepository } from './UserDialogsRepository';
import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { injectable, inject } from 'inversify';
import { Context } from '@openland/context';
import { ImageRef } from 'openland-module-media/ImageRef';
import { ChatMetricsRepository } from './ChatMetricsRepository';
import {
    Message,
    UserDialogBumpEvent, UserDialogCallStateChangedEvent,
    UserDialogDeletedEvent, UserDialogGotAccessEvent, UserDialogLostAccessEvent,
    UserDialogMessageDeletedEvent,
    UserDialogMessageReadEvent,
    UserDialogMessageReceivedEvent,
    UserDialogMessageUpdatedEvent,
    UserDialogMuteChangedEvent,
    UserDialogPeerUpdatedEvent,
    UserDialogPhotoUpdatedEvent,
    UserDialogTitleUpdatedEvent,
} from 'openland-module-db/store';

@injectable()
export class DeliveryRepository {
    private readonly metrics: ChatMetricsRepository;
    private readonly userDialogs: UserDialogsRepository;

    constructor(
        @inject('ChatMetricsRepository') metrics: ChatMetricsRepository,
        @inject('UserDialogsRepository') userDialogs: UserDialogsRepository
    ) {
        this.metrics = metrics;
        this.userDialogs = userDialogs;
    }

    async deliverMessageToUser(parent: Context, uid: number, message: Message) {
        await inTx(parent, async (ctx) => {

            // Count Metrics
            if (message.uid !== uid) {
                this.metrics.onMessageReceived(ctx, uid);
            }

            // Update dialog and deliver update
            this.userDialogs.bumpDialog(ctx, uid, message.cid, message.metadata.createdAt);

            // Persist Event
            Store.UserDialogEventStore.post(ctx, uid, UserDialogMessageReceivedEvent.create({
                uid,
                cid: message.cid,
                mid: message.id
            }));
        });
    }

    async deliverDialogBumpToUser(parent: Context, uid: number, cid: number, date: number) {
        await inTx(parent, async (ctx) => {

            // Update dialog and deliver update
            this.userDialogs.bumpDialog(ctx, uid, cid, date);

            // Persist Event
            Store.UserDialogEventStore.post(ctx, uid, UserDialogBumpEvent.create({
                uid,
                cid,
            }));
        });
    }

    async deliverMessageUpdateToUser(parent: Context, uid: number, message: Message) {
        await inTx(parent, async (ctx) => {
            // Persist Event
            Store.UserDialogEventStore.post(ctx, uid, UserDialogMessageUpdatedEvent.create({
                uid,
                cid: message.cid,
                mid: message.id
            }));
        });
    }

    async deliverMessageDeleteToUser(parent: Context, uid: number, message: Message) {
        await inTx(parent, async (ctx) => {
            // TODO: Update date
            Store.UserDialogEventStore.post(ctx, uid, UserDialogMessageDeletedEvent.create({
                uid,
                cid: message.cid,
                mid: message.id
            }));
        });
    }

    async deliverDialogTitleUpadtedToUser(parent: Context, uid: number, cid: number, title: string) {
        await inTx(parent, async (ctx) => {
            Store.UserDialogEventStore.post(ctx, uid, UserDialogTitleUpdatedEvent.create({
                uid,
                cid,
                title
            }));
        });
    }

    async deliverDialogPhotoUpadtedToUser(parent: Context, uid: number, cid: number, photo?: ImageRef) {
        await inTx(parent, async (ctx) => {
            Store.UserDialogEventStore.post(ctx, uid, UserDialogPhotoUpdatedEvent.create({
                uid,
                cid,
                photo
            }));
        });
    }

    async deliverDialogMuteChangedToUser(parent: Context, uid: number, cid: number, mute: boolean) {
        await inTx(parent, async (ctx) => {
            Store.UserDialogEventStore.post(ctx, uid, UserDialogMuteChangedEvent.create({
                uid,
                cid,
                mute
            }));
            // TODO: remove this update, clients should respect global counter in dialog_mute_changed event
            Store.UserDialogEventStore.post(ctx, uid, UserDialogMessageReadEvent.create({
                uid,
                cid,
            }));
        });
    }

    async deliverDialogDeleteToUser(parent: Context, uid: number, cid: number) {
        return await inTx(parent, async (ctx) => {

            // Update metrics
            this.metrics.onChatDeleted(ctx, uid);
            let chat = await Store.Conversation.findById(ctx, cid);
            if (chat && chat.kind === 'private') {
                this.metrics.onDirectChatDeleted(ctx, uid);
            }
            if (chat && chat.kind === 'room') {
                let room = await Store.ConversationRoom.findById(ctx, cid);
                if (room && room.isChannel) {
                    this.metrics.onChannelLeave(ctx, uid);
                }
            }

            // Remove dialog
            this.userDialogs.removeDialog(ctx, uid, cid);

            // Write event
            Store.UserDialogEventStore.post(ctx, uid, UserDialogDeletedEvent.create({
                uid,
                cid,
            }));
        });
    }

    async deliverMessageReadToUser(parent: Context, uid: number, mid: number) {
        await inTx(parent, async (ctx) => {
            let msg = await Store.Message.findById(ctx, mid);
            if (!msg) {
                throw Error('Unable to find message');
            }

            // Deliver update
            Store.UserDialogEventStore.post(ctx, uid, UserDialogMessageReadEvent.create({
                uid,
                cid: msg.cid,
                mid
            }));
        });
    }

    async deliverGlobalCounterToUser(parent: Context, uid: number) {
        // TODO: create new event type for this
        await inTx(parent, async (ctx) => {
            let cid = await this.userDialogs.findAnyUserDialog(ctx, uid);
            if (cid === null) {
                return;
            }

            // Deliver update
            Store.UserDialogEventStore.post(ctx, uid, UserDialogMessageReadEvent.create({
                uid,
                cid,
            }));
        });
    }

    async deliverDialogPeerUpdatedToUser(parent: Context, uid: number, cid: number) {
        await inTx(parent, async (ctx) => {
            // Persist Event
            Store.UserDialogEventStore.post(ctx, uid, UserDialogPeerUpdatedEvent.create({
                uid,
                cid,
            }));
        });
    }

    async deliverDialogGotAccessToUser(parent: Context, uid: number, cid: number) {
        await inTx(parent, async (ctx) => {
            // Persist Event
            Store.UserDialogEventStore.post(ctx, uid, UserDialogGotAccessEvent.create({
                uid,
                cid,
            }));
        });
    }

    async deliverDialogLostAccessToUser(parent: Context, uid: number, cid: number) {
        await inTx(parent, async (ctx) => {
            // Persist Event
            Store.UserDialogEventStore.post(ctx, uid, UserDialogLostAccessEvent.create({
                uid,
                cid,
            }));
        });
    }

    deliverCallStateChangedToUser(ctx: Context, uid: number, cid: number, hasActiveCall: boolean) {
        Store.UserDialogEventStore.post(ctx, uid, UserDialogCallStateChangedEvent.create({
            uid,
            cid,
            hasActiveCall
        }));
    }
}