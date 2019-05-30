import { AllEntities, Message } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { injectable, inject } from 'inversify';
import { UserStateRepository } from './UserStateRepository';
import { Context } from 'openland-utils/Context';
import { ImageRef } from 'openland-module-media/ImageRef';

@injectable()
export class DeliveryRepository {
    private readonly entities: AllEntities;
    private readonly userState: UserStateRepository;

    constructor(
        @inject('FDB') entities: AllEntities,
        @inject('UserStateRepository') userState: UserStateRepository
    ) {
        this.entities = entities;
        this.userState = userState;
    }

    async deliverMessageToUser(parent: Context, uid: number, message: Message) {
        await inTx(parent, async (ctx) => {
            // Update dialog and deliver update
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            local.date = message.createdAt;

            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            if (message.uid !== uid) {
                if (!global.messagesReceived) {
                    global.messagesReceived = 1;
                } else {
                    global.messagesReceived++;
                }
            }

            // Make Event as UNSAFE since we guarantee unique id
            await this.entities.UserDialogEvent.create_UNSAFE(ctx, uid, global.seq, {
                kind: 'message_received',
                cid: message.cid,
                mid: message.id,
                allUnread: 0,
                unread: 0
            });
        });
    }

    async deliverDialogBumpToUser(parent: Context, uid: number, cid: number, date: number) {
        await inTx(parent, async (ctx) => {

            // Update dialog and deliver update
            let local = await this.userState.getUserDialogState(ctx, uid, cid);
            local.date = date;
            
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'dialog_bump',
                cid: cid,
                allUnread: 0,
                unread: 0
            });
        });
    }

    async deliverMessageUpdateToUser(parent: Context, uid: number, mid: number) {
        await inTx(parent, async (ctx) => {
            let message = (await this.entities.Message.findById(ctx, mid));
            if (!message) {
                throw Error('Message not found');
            }
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'message_updated',
                cid: message.cid,
                mid: mid
            });
        });
    }

    async deliverMessageDeleteToUser(parent: Context, uid: number, mid: number) {
        await inTx(parent, async (ctx) => {
            let message = (await this.entities.Message.findById(ctx, mid));
            if (!message) {
                throw Error('Message not found');
            }

            // TODO: Update date
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'message_deleted',
                cid: message.cid,
                mid: message.id,
                allUnread: 0,
                unread: 0
            });
        });
    }

    async deliverDialogTitleUpadtedToUser(parent: Context, uid: number, cid: number, title: string) {
        await inTx(parent, async (ctx) => {

            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
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
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
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
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'dialog_mute_changed',
                cid,
                mute,
                allUnread: 0
            });
        });
    }

    async deliverDialogMentionedChangedToUser(parent: Context, uid: number, cid: number, haveMention: boolean) {
        await inTx(parent, async (ctx) => {
            
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'dialog_mentioned_changed',
                cid,
                haveMention
            });
        });
    }

    async deliverDialogDeleteToUser(parent: Context, uid: number, cid: number) {
        return await inTx(parent, async (ctx) => {
            
            let local = await this.userState.getUserDialogState(ctx, uid, cid);
            local.date = null;

            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            if (global.chatsCount) {
                global.chatsCount--;
            }
            let chat = await this.entities.Conversation.findById(ctx, cid);
            if (chat && chat.kind === 'private') {
                if (global.directChatsCount) {
                    global.directChatsCount--;
                }
            }
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'dialog_deleted',
                cid: cid,
                unread: 0,
                allUnread: 0
            });
        });
    }

    async deliverMessageReadToUser(parent: Context, uid: number, mid: number, delta: number) {
        await inTx(parent, async (ctx) => {
            let msg = await this.entities.Message.findById(ctx, mid);
            if (!msg) {
                throw Error('Unable to find message');
            }

            // Deliver update if needed
            if (delta !== 0) {
                let global = await this.userState.getUserMessagingState(ctx, uid);
                global.seq++;
                await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                    kind: 'message_read',
                    cid: msg.cid,
                    unread: 0,
                    allUnread: 0
                });
            }
        });
    }

    async deliverCurrentCountersToUser(parent: Context, uid: number, cid: number) {
        await inTx(parent, async (ctx) => {

            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'message_read',
                cid: cid,
                unread: 0,
                allUnread: 0
            });
        });
    }
}