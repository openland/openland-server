import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';

export class MessagingRepository {
    readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    // async createMessage(cid: string, uid: number, message: MessageInput) {
    //     await inTx(async () => {

    //         // 1. Create Message
    //         let mid = await this.entities.connection.nextRandomId();
    //         await this.entities.Message.create(mid, {
    //             cid,
    //             uid,
    //             ...message,
    //             deleted: false
    //         });

    //         // 2. Schedule event
    //         let seq = await this.fetchConversationNextSeq(cid);
    //         await this.entities.ConversationEvent.create(cid, seq, {
    //             kind: 'create_message',
    //             messageId: mid,
    //             userId: uid,
    //         });
    //     });
    // }

    // async updateMessage(mid: string, message: Partial<MessageInput>) {
    //     await inTx(async () => {

    //         // 1. Find message
    //         let msg = await this.entities.Message.findById(mid);
    //         if (!msg) {
    //             throw Error('Unable to find message');
    //         }

    //         // 2. Update message
    //         if (message.text) {
    //             msg.text = message.text;
    //         }
    //         if (message.mentions) {
    //             msg.mentions = message.mentions;
    //         }

    //         // 3. Schedule update
    //         let seq = await this.fetchConversationNextSeq(msg.cid);
    //         await this.entities.ConversationEvent.create(msg.cid, seq, {
    //             kind: 'update_message',
    //             messageId: mid,
    //         });
    //     });
    // }

    // async deleteMessage(mid: string) {
    //     await inTx(async () => {

    //         // 1. Find message
    //         let msg = await this.entities.Message.findById(mid);
    //         if (!msg) {
    //             throw Error('Unable to find message');
    //         }

    //         // 2. Update message
    //         msg.deleted = true;

    //         // 3. Schedule update
    //         let seq = await this.fetchConversationNextSeq(msg.cid);
    //         await this.entities.ConversationEvent.create(msg.cid, seq, {
    //             kind: 'delete_message',
    //             messageId: mid,
    //         });
    //     });
    // }

    // async processConversationEvent(uid: number, event: ConversationEvent) {
    //     await inTx(async () => {

    //         if (event.kind === 'create_message') {

    //             // 1. Increment user counter
    //             let senderId = event.userId!;
    //             if (uid !== senderId) {
    //                 await this.updateUserUnreadCounter(uid, 1);
    //             }

    //             // 2. Create Event
    //             let seq = await this.fetchUserNextSeq(uid);
    //             let unread = await this.fetchUserUnread(uid);
    //             await this.entities.UserMessagingEvent.create(uid, seq, {
    //                 allUnread: unread,
    //                 convUnread: 0,

    //                 kind: 'create_message',
    //                 messageId: event.messageId,
    //                 userId: uid,
    //             });
    //         } else if (event.kind === 'update_message') {
    //             // 1. Create Event
    //             let seq = await this.fetchUserNextSeq(uid);
    //             let unread = await this.fetchUserUnread(uid);
    //             await this.entities.UserMessagingEvent.create(uid, seq, {
    //                 allUnread: unread,
    //                 convUnread: 0,

    //                 kind: 'update_message',
    //                 messageId: event.messageId
    //             });
    //         } else if (event.kind === 'delete_message') {

    //             // 1. Create Event
    //             let seq = await this.fetchUserNextSeq(uid);
    //             let unread = await this.fetchUserUnread(uid);
    //             await this.entities.UserMessagingEvent.create(uid, seq, {
    //                 allUnread: unread,
    //                 convUnread: 0,

    //                 kind: 'delete_message',
    //                 messageId: event.messageId
    //             });
    //         }
    //     });
    // }

    async fetchConversationNextSeq(cid: number) {
        return await inTx(async () => {
            let existing = await this.entities.ConversationSeq.findById(cid);
            let seq = 1;
            if (!existing) {
                await (await this.entities.ConversationSeq.create(cid, { seq: 1 })).flush();
            } else {
                seq = ++existing.seq;
                await existing.flush();
            }
            return seq;
        });
    }

    // async updateUserUnreadCounter(uid: number, delta: number) {
    //     if (delta === 0) {
    //         return;
    //     }
    //     await inTx(async () => {
    //         let existing = await this.entities.UserMessagingState.findById(uid);
    //         if (!existing) {
    //             if (delta < 0) {
    //                 throw Error('Internal inconsistency');
    //             }
    //             await (await this.entities.UserMessagingState.create(uid, { unread: delta, seq: 1 })).flush();
    //         } else {
    //             if (existing.unread + delta < 0) {
    //                 throw Error('Internal inconsistency');
    //             }
    //             existing.unread += delta;
    //             await existing.flush();
    //         }
    //     });
    // }

    // async fetchUserNextSeq(uid: number) {
    //     return await inTx(async () => {
    //         let existing = await this.entities.UserMessagingState.findById(uid);
    //         if (!existing) {
    //             await (await this.entities.UserMessagingState.create(uid, { unread: 0, seq: 1 })).flush();
    //             return 1;
    //         } else {
    //             let res = ++existing.seq;
    //             await existing.flush();
    //             return res;
    //         }
    //     });
    // }

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
}