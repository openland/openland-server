import { AllEntities, ConversationEvent } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { MessageInput } from 'openland-module-messaging/MessageInput';
import { injectable, inject } from 'inversify';

@injectable()
export class MessagingRepository {
    readonly entities: AllEntities;

    constructor(@inject('FDB') entities: AllEntities) {
        this.entities = entities;
    }

    async createMessage(conversationId: number, uid: number, message: MessageInput): Promise<ConversationEvent> {
        return await inTx(async () => { 

            // 
            // Persist Messages
            //

            let mid = await this.fetchNextMessageId();
            await this.entities.Message.create(mid, {
                cid: conversationId,
                uid: uid,
                isMuted: message.isMuted || false,
                isService: message.isService || false,
                fileId: message.file,
                fileMetadata: message.fileMetadata,
                text: message.message,
                serviceMetadata: message.serviceMetadata || null,
                augmentation: message.urlAugmentation,
                replyMessages: message.replyMessages,
                mentions: message.mentions,
                repeatKey: message.repeatKey,
                deleted: false
            });

            //
            // Write Event
            //

            let seq = await this.fetchConversationNextSeq(conversationId);
            let res = await this.entities.ConversationEvent.create(conversationId, seq, {
                kind: 'message_received',
                mid: mid
            });
            return res;
        });
    }

    async editMessage(messageId: number, newMessage: MessageInput, markAsEdited: boolean): Promise<ConversationEvent> {
        return await inTx(async () => {
            let message = await this.entities.Message.findById(messageId);
            if (!message) {
                throw new Error('Message not found');
            }

            //
            // Update message
            //

            if (newMessage.message) {
                message.text = newMessage.message;
            }
            if (newMessage.file) {
                message.fileId = newMessage.file;
            }
            if (newMessage.fileMetadata) {
                message.fileMetadata = newMessage.fileMetadata;
            }
            // if (newMessage.filePreview) {
            //     (message as any).changed('extras', true);
            //     message.extras.filePreview = newMessage.filePreview;
            // }
            if (newMessage.replyMessages) {
                message.replyMessages = newMessage.replyMessages;
            }
            if (newMessage.urlAugmentation || newMessage.urlAugmentation === null) {
                message.augmentation = newMessage.urlAugmentation;
            }
            if (newMessage.mentions) {
                message.mentions = newMessage.mentions;
            }

            if (markAsEdited) {
                message.edited = true;
            }

            //
            // Write Event
            //

            let seq = await this.fetchConversationNextSeq(message!.cid);
            let res = await this.entities.ConversationEvent.create(message!.cid, seq, {
                kind: 'message_updated',
                mid: message!.id
            });

            return res;
        });
    }

    async deleteMessage(messageId: number, uid: number): Promise<ConversationEvent> {
        return await inTx(async () => {
            let message = (await this.entities.Message.findById(messageId));

            if (!message) {
                throw new Error('Message not found');
            }

            //
            // Delete message
            //

            message.deleted = true;

            //
            // Write Event
            //

            let seq = await this.fetchConversationNextSeq(message.cid);
            let res = await this.entities.ConversationEvent.create(message.cid, seq, {
                kind: 'message_deleted',
                mid: message!.id
            });

            return res;
        });
    }

    async setReaction(messageId: number, uid: number, reaction: string, reset: boolean = false) {
        return await inTx(async () => {
            let message = await this.entities.Message.findById(messageId);

            if (!message) {
                throw new Error('Message not found');
            }

            //
            // Update message
            //

            let reactions: { reaction: string, userId: number }[] = message.reactions ? [...message.reactions] as any : [];
            if (reactions.find(r => (r.userId === uid) && (r.reaction === reaction))) {
                if (reset) {
                    reactions = reactions.filter(r => !((r.userId === uid) && (r.reaction === reaction)));
                } else {
                    return;

                }
            } else {
                reactions.push({ userId: uid, reaction });
            }
            message.reactions = reactions;

            //
            // Write Event
            //

            let seq = await this.fetchConversationNextSeq(message!.cid);
            let res = await this.entities.ConversationEvent.create(message!.cid, seq, {
                kind: 'message_updated',
                mid: message!.id
            });

            return res;
        });
    }

    /**
     * @deprecated top message should be persisted in dialog list
     * @param cid conversation id
     */
    async findTopMessage(cid: number) {
        let res = await this.entities.Message.rangeFromChat(cid, 1, true);
        if (res.length === 0) {
            return null;
        } else {
            return res[0];
        }
    }

    private async fetchConversationNextSeq(cid: number) {
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

    private async fetchNextMessageId() {
        return await inTx(async () => {
            let ex = await this.entities.Sequence.findById('message-id');
            if (ex) {
                let res = ++ex.value;
                await ex.flush();
                return res;
            } else {
                await this.entities.Sequence.create('message-id', { value: 1 });
                return 1;
            }
        });
    }
}