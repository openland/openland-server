import { MessageUpdatedEvent, MessageDeletedEvent } from './../../openland-module-db/store';
import { Message, MessageReceivedEvent } from 'openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import {
    MessageAttachment,
    MessageAttachmentInput,
    MessageInput,
} from 'openland-module-messaging/MessageInput';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { DoubleInvokeError } from '../../openland-errors/DoubleInvokeError';
import { lazyInject } from '../../openland-modules/Modules.container';
import { ChatMetricsRepository } from './ChatMetricsRepository';
import { RandomLayer } from '@openland/foundationdb-random';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { REACTIONS, REACTIONS_LEGACY } from '../resolvers/ModernMessage.resolver';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { Sanitizer } from '../../openland-utils/Sanitizer';
import uuid from 'uuid';

@injectable()
export class MessagingRepository {
    @lazyInject('ChatMetricsRepository')
    private readonly chatMetrics!: ChatMetricsRepository;

    async createMessage(parent: Context, cid: number, uid: number, message: MessageInput): Promise<{ message: Message }> {
        return await inTx(parent, async (ctx) => {
            //
            // Check for duplicates
            //
            if (message.repeatKey && await Store.Message.repeat.find(ctx, uid, cid, message.repeatKey)) {
                throw new DoubleInvokeError();
            }

            //
            // Check if sticker exists
            //
            if (message.stickerId) {
                let sticker = await Store.Sticker.findById(ctx, message.stickerId);
                if (!sticker) {
                    throw new NotFoundError();
                }
            }

            //
            // Prepare attachments
            //
            let attachments: MessageAttachment[] = await this.prepareAttachments(ctx, message.attachments || []);
            if (message.purchaseId) {
                attachments.unshift({
                    type: 'purchase_attachment',
                    pid: message.purchaseId,
                    id: uuid()
                });
            }

            if (message.overrideAvatar) {
                await Modules.Media.saveFile(ctx, message.overrideAvatar.uuid);
                message.overrideAvatar = Sanitizer.sanitizeImageRef(message.overrideAvatar);
            }

            if (message.overrideName) {
                message.overrideName = message.overrideName.trim();
                message.overrideName = message.overrideName.length > 0 ? message.overrideName : null;
            }

            //
            // Persist Messages
            //
            Store.ConversationLastSeq.byId(cid).increment(ctx);
            let seq = await Store.ConversationLastSeq.byId(cid).get(ctx);
            let mid = await this.fetchNextMessageId(ctx);
            let msg = await Store.Message.create(ctx, mid, {
                cid: cid,
                uid: uid,
                seq: seq,
                isMuted: message.isMuted || false,
                isService: message.isService || false,
                hiddenForUids: message.hiddenForUids || [],
                text: message.message,
                serviceMetadata: message.serviceMetadata || null,
                replyMessages: message.replyMessages,
                repeatKey: message.repeatKey,
                deleted: false,
                spans: (message.spans && message.spans.length > 0) ? message.spans : null,
                stickerId: message.stickerId,
                attachmentsModern: attachments.length > 0 ? attachments : null,
                overrideAvatar: message.overrideAvatar,
                overrideName: message.overrideName,
            });

            //
            // Write Event
            //

            Store.ConversationEventStore.post(ctx, cid, MessageReceivedEvent.create({
                cid,
                mid,
                hiddenForUids: message.hiddenForUids || []
            }));

            //
            // Update user counter
            //
            if (!message.isService) {
                this.chatMetrics.onMessageSent(ctx, uid);
                await Modules.Stats.onMessageSent(ctx, uid);
            }
            let conv = await Store.Conversation.findById(ctx, cid);
            let direct = conv && conv.kind === 'private';
            if (direct) {
                await this.chatMetrics.onMessageSentDirect(ctx, uid, cid);
            } else {
                await Modules.Stats.onRoomMessageSent(ctx, cid);
            }

            // Update shared media
            await this.indexSharedMedia(ctx, msg, attachments);

            //
            // Notify hooks
            //
            await Modules.Hooks.onMessageSent(ctx, uid);

            return {
                message: msg
            };
        });
    }

    async editMessage(parent: Context, mid: number, newMessage: MessageInput, markAsEdited: boolean): Promise<void> {
        await inTx(parent, async (ctx) => {
            let message = await Store.Message.findById(ctx, mid);
            if (!message) {
                throw new Error('Message not found');
            }

            //
            // Update message
            //

            if (newMessage.message) {
                message.text = newMessage.message;
            }
            if (newMessage.replyMessages) {
                message.replyMessages = newMessage.replyMessages;
            }
            if (markAsEdited) {
                message.edited = true;
            }
            if (newMessage.attachments) {
                let attachments = await this.prepareAttachments(ctx, newMessage.attachments || []);
                if (newMessage.appendAttachments) {
                    let startIndex = (message.attachmentsModern?.length || 0);
                    message.attachmentsModern = [...(message.attachmentsModern || []), ...attachments];
                    await this.indexSharedMedia(ctx, message, attachments, startIndex);
                } else {
                    message.attachmentsModern = attachments;
                    let prevSharedMedia = await Store.MessageSharedMedia.message.findAll(ctx, message.id);
                    for (let media of prevSharedMedia) {
                        media.deleted = true;
                    }
                    await this.indexSharedMedia(ctx, message, attachments);
                }
            }
            if (newMessage.spans) {
                message.spans = newMessage.spans;
            }
            if (newMessage.serviceMetadata) {
                message.serviceMetadata = newMessage.serviceMetadata;
            }

            //
            // Write Event
            //

            Store.ConversationEventStore.post(ctx, message!.cid, MessageUpdatedEvent.create({
                cid: message!.cid,
                mid,
                hiddenForUids: message.hiddenForUids || []
            }));
        });
    }

    async deleteMessage(parent: Context, mid: number): Promise<void> {
        await inTx(parent, async (ctx) => {
            let message = (await Store.Message.findById(ctx, mid));

            if (!message || message.deleted) {
                throw new Error('Message not found');
            }

            //
            // Delete message
            //

            message.deleted = true;
            // Delete shared media
            let prevSharedMedia = await Store.MessageSharedMedia.message.findAll(ctx, message.id);
            for (let media of prevSharedMedia) {
                media.deleted = true;
            }

            //
            // Write Event
            //

            Store.ConversationEventStore.post(ctx, message!.cid, MessageDeletedEvent.create({
                cid: message!.cid,
                mid,
                hiddenForUids: message.hiddenForUids || []
            }));
        });
    }

    async setReaction(parent: Context, mid: number, uid: number, reaction: string, reset: boolean = false) {
        return await inTx(parent, async (ctx) => {
            reaction = this.toModernReaction(reaction);
            let message = await Store.Message.findById(ctx, mid);

            if (!message) {
                throw new Error('Message not found');
            }

            //
            // Update message
            //

            let reactions: { reaction: string, userId: number }[] = message.reactions ? [...message.reactions] as any : [];
            reactions = [...this.prepareReactions(reactions)];

            if (reactions.find(r => (r.userId === uid) && (r.reaction === reaction))) {
                if (reset) {
                    reactions = reactions.filter(r => !((r.userId === uid) && (r.reaction === reaction)));
                } else {
                    return false;
                }
            } else {
                reactions.push({ userId: uid, reaction });
            }
            message.reactions = reactions;

            if (!reset) {
                await Modules.Stats.onReactionSet(ctx, message, uid);
            }

            //
            // Write Event
            //

            Store.ConversationEventStore.post(ctx, message!.cid, MessageUpdatedEvent.create({
                cid: message!.cid,
                mid
            }));
            return true;
        });
    }

    async markMessageUpdated(parent: Context, mid: number) {
        await inTx(parent, async (ctx) => {
            let message = await Store.Message.findById(ctx, mid);

            if (!message) {
                throw new Error('Message not found');
            }

            Store.ConversationEventStore.post(ctx, message!.cid, MessageUpdatedEvent.create({
                cid: message!.cid,
                mid
            }));
        });
    }

    /**
     * @deprecated top message should be persisted in dialog list
     * @param cid conversation id
     */
    async findTopMessage(ctx: Context, cid: number, forUid: number) {
        let res = (await Store.Message.chat.query(ctx, cid, { limit: 1, reverse: true })).items;
        if (res.length === 0) {
            return null;
        } else {
            let msg = res[0];
            // this can be slow if we allow hidden messages for users, but ok for service purposes
            // in general we should store top message in user dialogs list & update it via delivery workers
            while (msg.hiddenForUids && msg.hiddenForUids.includes(forUid)) {
                let res2 = (await Store.Message.chat.query(ctx, cid, { limit: 1, reverse: true, after: msg.id })).items;
                if (res2.length === 0) {
                    return null;
                }
                msg = res2[0];
            }
            return msg;
        }
    }

    async fetchConversationNextSeq(parent: Context, cid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.ConversationSeq.findById(ctx, cid);
            let seq = 1;
            if (!existing) {
                await (await Store.ConversationSeq.create(ctx, cid, { seq: 1 })).flush(ctx);
            } else {
                seq = ++existing.seq;
                await existing.flush(ctx);
            }
            return seq;
        });
    }

    private async fetchNextMessageId(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let ex = await Store.Sequence.findById(ctx, 'message-id');
            if (ex) {
                let res = ++ex.value;
                await ex.flush(ctx);
                return res;
            } else {
                await Store.Sequence.create(ctx, 'message-id', { value: 1 });
                return 1;
            }
        });
    }

    private async prepareAttachments(parent: Context, attachments: MessageAttachmentInput[]) {
        return await inTx(parent, async (ctx) => {
            let res: MessageAttachment[] = [];

            for (let attachInput of attachments) {
                res.push({
                    ...attachInput,
                    id: Store.storage.db.get(RandomLayer).nextRandomId()
                });
            }

            return res;
        });
    }

    private prepareReactions(reactions: ({ userId: number, reaction: string })[]): ({ userId: number, reaction: string })[] {
        return reactions.map(reaction => ({ userId: reaction.userId, reaction: this.toModernReaction(reaction.reaction) }));
    }

    private toModernReaction(reaction: string): string {
        if (REACTIONS.indexOf(reaction) > -1) {
            return reaction;
        }
        if (REACTIONS_LEGACY.has(reaction)) {
            return REACTIONS_LEGACY.get(reaction)!;
        }
        return 'LIKE';
    }

    private async indexSharedMedia(ctx: Context, msg: Message, attachments: MessageAttachment[], startIndex: number = 0) {
        for (let i = startIndex; i < attachments.length + startIndex; i++) {
            let attach = attachments[i - startIndex];

            let sharedMediaType: 'document' | 'link' | 'image'| 'video' | null = null;
            if (attach.type === 'file_attachment') {
                if (attach.fileMetadata && attach.fileMetadata.isImage) {
                    sharedMediaType = 'image';
                } else if (attach.fileMetadata && attach.fileMetadata.mimeType.startsWith('video/')) {
                    sharedMediaType = 'video';
                } else if (attach.fileId) {
                    sharedMediaType = 'document';
                }
            } else if (attach.type === 'rich_attachment') {
                sharedMediaType = 'link';
            }
            if (!sharedMediaType) {
                continue;
            }

            await Store.MessageSharedMedia.create(ctx, msg.cid, msg.id, attach.id, {
                deleted: false,
                orderKey: msg.id * 100 + i,
                type: sharedMediaType,
            });
        }
    }
}
