import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';

export class DialogsRepository {
    readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async getConversationSettings(uid: number, cid: number) {
        return await inTx(async () => {
            let res = await this.entities.UserDialogSettings.findById(uid, cid);
            if (res) {
                return res;
            }
            return await this.entities.UserDialogSettings.create(uid, cid, { mute: false });
        });
    }

    async deliverMessageToUser(uid: number, mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(mid))!;
            let conversationId = message.cid;
            let senderUid = message.uid;

            let existing = await this.getUserDialogState(uid, conversationId);
            let existingGlobal = await this.getUserMessagingState(uid);

            // Write user's chat state
            if (senderUid !== uid) {
                existing.unread++;
            }

            // Update dialog date
            existing.date = message.createdAt;

            // Update global counters
            if (senderUid !== uid) {
                existingGlobal.unread++;
            }
            existingGlobal.seq++;

            // Write User Event
            await this.entities.UserDialogEvent.create(uid, existingGlobal.seq, {
                kind: 'message_received',
                cid: conversationId,
                mid: message.id,
                allUnread: existingGlobal.unread,
                unread: existing.unread
            });

            //
            // Send counter push notification to iOS
            // TODO: Remove
            await Modules.Push.sendCounterPush(uid, conversationId, existingGlobal.unread);
        });
    }

    async deliverMessageUpdateToUser(uid: number, mid: number) {
        await inTx(async () => {
            let global = await Modules.Messaging.dialogs.getUserMessagingState(uid);
            global.seq++;
            await this.entities.UserDialogEvent.create(uid, global.seq, {
                kind: 'message_updated',
                mid: mid
            });
        });
    }

    async deliverMessageDeleteToUser(uid: number, mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(mid))!;
            let senderUid = message.uid;

            let existing = await this.getUserDialogState(uid, message!.cid);
            let global = await this.getUserMessagingState(uid);

            if (senderUid !== uid) {
                if (!existing.readMessageId || existing.readMessageId < message!.id) {
                    existing.unread--;
                    global.unread--;
                    global.seq++;

                    await this.entities.UserDialogEvent.create(uid, global.seq, {
                        kind: 'message_read',
                        cid: message!.cid,
                        unread: existing.unread,
                        allUnread: global.unread
                    });
                }
            }

            global.seq++;
            await this.entities.UserDialogEvent.create(uid, global.seq, {
                kind: 'message_deleted',
                mid: message!.id
            });
        });
    }

    async fetchUserUnread(uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserMessagingState.findById(uid);
            if (!existing) {
                await (await this.entities.UserMessagingState.create(uid, { unread: 0, seq: 0 })).flush();
                return 0;
            } else {
                return existing.unread;
            }
        });
    }

    async getUserNotificationState(uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserNotificationsState.findById(uid);
            if (!existing) {
                let created = await this.entities.UserNotificationsState.create(uid, {});
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }

    async getUserMessagingState(uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserMessagingState.findById(uid);
            if (!existing) {
                let created = await this.entities.UserMessagingState.create(uid, { seq: 0, unread: 0 });
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }

    async getUserDialogState(uid: number, cid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserDialog.findById(uid, cid);
            if (!existing) {
                let created = await this.entities.UserDialog.create(uid, cid, { unread: 0 });
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }

    // TODO: Improve
    async deliverMessage(mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(mid))!;
            let conversationId = message.cid;
            let uid = message.uid;
            let members = await Modules.Messaging.conv.findConversationMembers(conversationId);

            // Deliver messages
            if (members.length > 0) {
                await Promise.all(members.map(async (m) => {
                    await this.deliverMessageToUser(m, mid);
                }));
            }

            // Cancel Typings
            await Modules.Typings.cancelTyping(uid, conversationId, members);

            // Notify augmentation worker
            await Modules.Messaging.AugmentationWorker.pushWork({ messageId: mid });
        });
    }
}