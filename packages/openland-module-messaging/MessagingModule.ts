import { createAugmentationWorker } from './workers/AugmentationWorker';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startEmailNotificationWorker } from './workers/EmailNotificationWorker';
import { startPushNotificationWorker } from './workers/PushNotificationWorker';
import { MessagingRepository } from './repositories/MessagingRepository';
import { FDB } from 'openland-module-db/FDB';
import { ChannelRepository } from './repositories/ChannelRepository';
import { inTx } from 'foundation-orm/inTx';
import { ChannelInviteEmails } from './emails/ChannelInviteEmails';
import { createDeliveryWorker } from './workers/DeliveryWorker';
import { DialogsRepository } from './repositories/DialogsRepository';
import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';

export interface MessageInput {
    repeatToken?: string | null;
    text?: string | null;
    fileId?: string | null;
    fileMetadata?: any | null;
    filePreview?: string | null;
    mentions?: any | null;
    replyMessages?: any | null;
    augmentation?: any | null;
    isMuted: boolean;
    isService: boolean;
}

export class MessagingModule {
    readonly AugmentationWorker = createAugmentationWorker();
    readonly DeliveryWorker = createDeliveryWorker();
    readonly repo = new MessagingRepository(FDB);
    private readonly dialogs = new DialogsRepository(FDB);
    private readonly channels = new ChannelRepository(FDB);

    start = () => {
        if (serverRoleEnabled('workers')) {
            startEmailNotificationWorker();
        }
        if (serverRoleEnabled('workers')) {
            startPushNotificationWorker();
        }

        let reader = new UpdateReader('export-global-messaging-state', 1, DB.ConversationsUserGlobal);
        reader.processor(async (items) => {
            for (let i of items) {
                await inTx(async () => {
                    let state = await FDB.UserMessagingState.findById(i.userId);
                    if (state) {
                        state.unread = i.unread;
                        state.seq = i.seq;
                    } else {
                        await FDB.UserMessagingState.create(i.userId, { unread: i.unread, seq: i.seq });
                    }
                });
            }
        });
        reader.start();

        let reader2 = new UpdateReader('export_dialog_states', 1, DB.ConversationUserState);
        reader2.processor(async (items) => {
            for (let i of items) {
                await inTx(async () => {
                    let existing = await FDB.UserDialog.findById(i.userId, i.conversationId);
                    if (existing) {
                        existing.date = i.updatedAt.getTime();
                        existing.unread = i.unread;
                        existing.readMessageId = i.readDate;
                    } else {
                        await FDB.UserDialog.create(i.userId, i.conversationId, {
                            date: i.updatedAt.getTime(),
                            unread: i.unread,
                            readMessageId: i.readDate
                        });
                    }
                });
            }
        });
        reader2.start();

        let reader3 = new UpdateReader('export_dialog_events', 1, DB.ConversationUserEvents);
        reader3.processor(async (items) => {
            for (let i of items) {
                await inTx(async () => {
                    let existing = await FDB.UserDialogEvent.findById(i.userId, i.seq);
                    if (!existing) {
                        if (i.eventType === 'new_message') {
                            await FDB.UserDialogEvent.create(i.userId, i.seq, {
                                kind: 'message_received',
                                cid: i.event.conversationId as number,
                                mid: i.event.messageId as number,
                                unread: i.event.unread as number,
                                allUnread: i.event.unreadGlobal as number
                            });
                        } else if (i.eventType === 'edit_message') {
                            await FDB.UserDialogEvent.create(i.userId, i.seq, {
                                kind: 'message_updated',
                                mid: i.event.messageId as number
                            });
                        } else if (i.eventType === 'delete_message') {
                            await FDB.UserDialogEvent.create(i.userId, i.seq, {
                                kind: 'message_deleted',
                                mid: i.event.messageId as number
                            });
                        } else if (i.eventType === 'conversation_read') {
                            await FDB.UserDialogEvent.create(i.userId, i.seq, {
                                kind: 'message_read',
                                cid: i.event.conversationId as number,
                                unread: i.event.unread as number,
                                allUnread: i.event.unreadGlobal as number
                            });
                        } else if (i.eventType === 'title_change') {
                            await FDB.UserDialogEvent.create(i.userId, i.seq, {
                                kind: 'title_updated',
                                cid: i.event.conversationId as number,
                                title: i.event.title as string,
                            });
                        }
                    }
                });
            }
        });
        reader3.start();
    }

    async getConversationSettings(uid: number, cid: number) {
        return await this.dialogs.getConversationSettings(uid, cid);
    }

    async resolveInvite(id: string) {
        return await this.channels.resolveInvite(id);
    }

    async createChannelInviteLink(channelId: number, uid: number) {
        return await this.channels.createChannelInviteLink(channelId, uid);
    }

    async refreshChannelInviteLink(channelId: number, uid: number) {
        return await this.channels.refreshChannelInviteLink(channelId, uid);
    }

    async createChannelInvite(channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await inTx(async () => {
            let invite = await this.channels.createChannelInvite(channelId, uid, email, emailText, firstName, lastName);
            await ChannelInviteEmails.sendChannelInviteEmail(invite);
            return invite;
        });
    }
}