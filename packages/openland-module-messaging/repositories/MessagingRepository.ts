import { AllEntities, ConversationEvent, Message } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { MessageAttachment, MessageAttachmentInput, MessageInput } from 'openland-module-messaging/MessageInput';
import { injectable, inject } from 'inversify';
import { Context } from 'openland-utils/Context';
import { DoubleInvokeError } from '../../openland-errors/DoubleInvokeError';

@injectable()
export class MessagingRepository {
    readonly entities: AllEntities;

    constructor(@inject('FDB') entities: AllEntities) {
        this.entities = entities;
    }

    async createMessage(parent: Context, cid: number, uid: number, message: MessageInput): Promise<{ event: ConversationEvent, message: Message }> {
        return await inTx(parent, async (ctx) => {

            // 
            // Persist Messages
            //

            if (message.repeatKey && await this.entities.Message.findFromRepeat(ctx, uid, cid, message.repeatKey)) {
                throw new DoubleInvokeError();
            }

            let attachments: MessageAttachment[] = await this.prepateAttachments(ctx, message.attachments || []);

            let mid = await this.fetchNextMessageId(ctx);
            let msg = await this.entities.Message.create(ctx, mid, {
                cid: cid,
                uid: uid,
                isMuted: message.isMuted || false,
                isService: message.isService || false,
                // fileId: message.file,
                // fileMetadata: message.fileMetadata,
                // filePreview: message.filePreview,
                text: message.message,
                serviceMetadata: message.serviceMetadata || null,
                // augmentation: message.urlAugmentation,
                replyMessages: message.replyMessages,
                mentions: message.mentions,
                repeatKey: message.repeatKey,
                deleted: false,

                // type: message.type || 'MESSAGE',
                // title: message.title,
                // buttons: message.buttons,
                // postType: message.postType,
                // attachments: message.attachments,

                complexMentions: message.complexMentions,
                spans: message.spans,
                attachmentsModern: attachments.length > 0 ? attachments : null
            });

            //
            // Write Event
            //

            let seq = await this.fetchConversationNextSeq(ctx, cid);
            let res = await this.entities.ConversationEvent.create(ctx, cid, seq, {
                kind: 'message_received',
                uid: uid,
                mid: mid
            });
            return {
                event: res,
                message: msg
            };
        });
    }

    async editMessage(parent: Context, mid: number, newMessage: MessageInput, markAsEdited: boolean): Promise<ConversationEvent> {
        return await inTx(parent, async (ctx) => {
            let message = await this.entities.Message.findById(ctx, mid);
            if (!message) {
                throw new Error('Message not found');
            }

            //
            // Update message
            //

            if (newMessage.message) {
                message.text = newMessage.message;
            }
            // if (newMessage.file) {
            //     message.fileId = newMessage.file;
            // }
            // if (newMessage.fileMetadata) {
            //     message.fileMetadata = newMessage.fileMetadata;
            // }
            // if (newMessage.filePreview) {
            //     message.filePreview = newMessage.filePreview;
            // }
            if (newMessage.replyMessages) {
                message.replyMessages = newMessage.replyMessages;
            }
            // if (newMessage.urlAugmentation !== undefined) {
            //     message.augmentation = newMessage.urlAugmentation;
            // }
            if (newMessage.mentions) {
                message.mentions = newMessage.mentions;
            }
            if (markAsEdited) {
                message.edited = true;
            }
            if (newMessage.attachments) {
                message.attachmentsModern = await this.prepateAttachments(ctx, newMessage.attachments || []);
            }
            if (newMessage.spans) {
                message.spans = newMessage.spans;
            }
            if (newMessage.serviceMetadata) {
                message.serviceMetadata = newMessage.serviceMetadata;
            }
            if (newMessage.complexMentions) {
                message.complexMentions = newMessage.complexMentions;
            }

            //
            // Write Event
            //

            let seq = await this.fetchConversationNextSeq(ctx, message!.cid);
            let res = await this.entities.ConversationEvent.create(ctx, message!.cid, seq, {
                kind: 'message_updated',
                mid: message!.id
            });

            return res;
        });
    }

    async deleteMessage(parent: Context, mid: number): Promise<ConversationEvent> {
        return await inTx(parent, async (ctx) => {
            let message = (await this.entities.Message.findById(ctx, mid));

            if (!message || message.deleted) {
                throw new Error('Message not found');
            }

            //
            // Delete message
            //

            message.deleted = true;
            //
            // Write Event
            //

            let seq = await this.fetchConversationNextSeq(ctx, message.cid);
            let res = await this.entities.ConversationEvent.create(ctx, message.cid, seq, {
                kind: 'message_deleted',
                mid: message!.id
            });

            return res;
        });
    }

    async prepateAttachments(parent: Context, attachments: MessageAttachmentInput[]) {
        return await inTx(parent, async (ctx) => {
            let res: MessageAttachment[] = [];

            for (let attachInput of attachments) {
                res.push({
                    ...attachInput,
                    id: await this.entities.connection.nextRandomId()
                });
            }

            return res;
        });
    }

    async setReaction(parent: Context, mid: number, uid: number, reaction: string, reset: boolean = false) {
        return await inTx(parent, async (ctx) => {
            let message = await this.entities.Message.findById(ctx, mid);

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

            let seq = await this.fetchConversationNextSeq(ctx, message!.cid);
            let res = await this.entities.ConversationEvent.create(ctx, message!.cid, seq, {
                kind: 'message_updated',
                mid: message!.id
            });

            return res;
        });
    }

    async markMessageUpdated(parent: Context, mid: number) {
        return await inTx(parent, async (ctx) => {
            let message = await this.entities.Message.findById(ctx, mid);

            if (!message) {
                throw new Error('Message not found');
            }

            let seq = await this.fetchConversationNextSeq(ctx, message!.cid);
            return await this.entities.ConversationEvent.create(ctx, message!.cid, seq, {
                kind: 'message_updated',
                mid: message!.id
            });
        });
    }

    /**
     * @deprecated top message should be persisted in dialog list
     * @param cid conversation id
     */
    async findTopMessage(ctx: Context, cid: number) {
        let res = await this.entities.Message.rangeFromChat(ctx, cid, 1, true);
        if (res.length === 0) {
            return null;
        } else {
            return res[0];
        }
    }

    async fetchConversationNextSeq(parent: Context, cid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.ConversationSeq.findById(ctx, cid);
            let seq = 1;
            if (!existing) {
                await (await this.entities.ConversationSeq.create(ctx, cid, { seq: 1 })).flush();
            } else {
                seq = ++existing.seq;
                await existing.flush();
            }
            return seq;
        });
    }

    private async fetchNextMessageId(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let ex = await this.entities.Sequence.findById(ctx, 'message-id');
            if (ex) {
                let res = ++ex.value;
                await ex.flush();
                return res;
            } else {
                await this.entities.Sequence.create(ctx, 'message-id', { value: 1 });
                return 1;
            }
        });
    }
}