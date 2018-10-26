import { AllEntities, ConversationEvent } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { MessageInput } from 'openland-module-messaging/MessagingModule';

export class MessagingRepository {
    readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async createMessage(cid: string, uid: number, message: MessageInput) {
        await inTx(async () => {

            // 1. Create Message
            let mid = await this.entities.connection.nextRandomId();
            this.entities.Message.create(mid, {
                cid,
                uid,
                ...message
            });

            // 2. Acqure seq and schedule event
            let existing = await this.entities.ConversationSeq.findById(cid);
            let seq = 1;
            if (!existing) {
                await this.entities.ConversationSeq.create(cid, { seq: 1 });
            } else {
                seq = ++existing.seq;
            }
            let event = await this.entities.ConversationEvent.create(cid, seq, {
                kind: 'create_message',
                messageId: mid,
                userId: uid,
            });

            // 3. Handle incoming event in-band
            return await this.handleConversationEvent(uid, event);
        });
    }

    async updateMessage(mid: string, message: MessageInput) {
        //
    }

    async deleteMessage(mid: string) {
        //
    }

    async handleConversationEvent(uid: number, event: ConversationEvent) {
        //
    }
}