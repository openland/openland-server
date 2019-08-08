import { UserDialogsRepository } from './UserDialogsRepository';
import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { injectable, inject } from 'inversify';
import { UserStateRepository } from './UserStateRepository';
import { Context } from '@openland/context';
import { ImageRef } from 'openland-module-media/ImageRef';
import { ChatMetricsRepository } from './ChatMetricsRepository';
import { Message } from 'openland-module-db/store';

@injectable()
export class DeliveryRepository {

    private readonly userState: UserStateRepository;
    private readonly metrics: ChatMetricsRepository;
    private readonly userDialogs: UserDialogsRepository;

    constructor(
        @inject('UserStateRepository') userState: UserStateRepository,
        @inject('ChatMetricsRepository') metrics: ChatMetricsRepository,
        @inject('UserDialogsRepository') userDialogs: UserDialogsRepository
    ) {
        this.userState = userState;
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
            await this.userDialogs.bumpDialog(ctx, uid, message.cid, message.metadata.createdAt);

            // Persist Event
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'message_received',
                cid: message.cid,
                mid: message.id,
                allUnread: 0,
                unread: 0,
                haveMention: false,
            });
        });
    }

    async deliverDialogBumpToUser(parent: Context, uid: number, cid: number, date: number) {
        await inTx(parent, async (ctx) => {

            // Update dialog and deliver update
            await this.userDialogs.bumpDialog(ctx, uid, cid, date);

            // Persist Event
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'dialog_bump',
                cid: cid,
                allUnread: 0,
                unread: 0,
                haveMention: false,
            });
        });
    }

    async deliverMessageUpdateToUser(parent: Context, uid: number, message: Message) {
        await inTx(parent, async (ctx) => {
            // Persist Event
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'message_updated',
                cid: message.cid,
                mid: message.id,
                haveMention: false,
            });
        });
    }

    async deliverMessageDeleteToUser(parent: Context, uid: number, message: Message) {
        await inTx(parent, async (ctx) => {
            // TODO: Update date
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'message_deleted',
                cid: message.cid,
                mid: message.id,
                allUnread: 0,
                unread: 0,
                haveMention: false,
            });
        });
    }

    async deliverDialogTitleUpadtedToUser(parent: Context, uid: number, cid: number, title: string) {
        await inTx(parent, async (ctx) => {

            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'title_updated',
                cid: cid,
                title: title,
            });
        });
    }

    async deliverDialogPhotoUpadtedToUser(parent: Context, uid: number, cid: number, photo?: ImageRef) {
        await inTx(parent, async (ctx) => {

            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'photo_updated',
                cid: cid,
                photo: photo,
            });
        });
    }

    async deliverDialogMuteChangedToUser(parent: Context, uid: number, cid: number, mute: boolean) {
        await inTx(parent, async (ctx) => {
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'dialog_mute_changed',
                cid,
                mute,
                allUnread: 0
            });

            // TODO: remove this update, clients should respect global counter in dialog_mute_changed event
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'message_read',
                cid: cid,
                unread: 0,
                allUnread: 0,
                haveMention: false,
            });
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

            // Remove dialog
            await this.userDialogs.removeDialog(ctx, uid, cid);

            // Write event
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'dialog_deleted',
                cid: cid,
                unread: 0,
                allUnread: 0
            });
        });
    }

    async deliverMessageReadToUser(parent: Context, uid: number, mid: number) {
        await inTx(parent, async (ctx) => {
            let msg = await Store.Message.findById(ctx, mid);
            if (!msg) {
                throw Error('Unable to find message');
            }

            // Deliver update
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'message_read',
                cid: msg.cid,
                unread: 0,
                allUnread: 0,
                haveMention: false,
            });
        });
    }

    async deliverGlobalCounterToUser(parent: Context, uid: number) {
        // TODO: create new event type for this
        await inTx(parent, async (ctx) => {
            let cid = await this.userDialogs.findAnyUserDialog(ctx, uid);
            if (cid !== null) {
                return;
            }

            // Deliver update
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            Store.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'message_read',
                cid: cid,
                unread: 0,
                allUnread: 0,
                haveMention: false,
            });
        });
    }
}