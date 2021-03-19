import { Message, PrivateMessage } from 'openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import {
    MessageAttachment,
    MessageAttachmentInput,
    MessageInput,
} from 'openland-module-messaging/MessageInput';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { DoubleInvokeError } from '../../openland-errors/DoubleInvokeError';
import { RandomLayer } from '@openland/foundationdb-random';
import { Store } from 'openland-module-db/FDB';
import { REACTIONS, REACTIONS_LEGACY } from '../resolvers/ModernMessage.resolver';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { Sanitizer } from '../../openland-utils/Sanitizer';
import uuid from 'uuid';
import { UserError } from '../../openland-errors/UserError';
import { isDefined } from '../../openland-utils/misc';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { createPrivateChatCleanerWorker } from '../workers/privateChatCleanerWorker';
import { RangeQueryOptions } from '@openland/foundationdb-entity';
import { USE_NEW_PRIVATE_CHATS } from '../MessagingModule';
import { hasDocumentAttachment, hasImageAttachment, hasLinkAttachment, hasVideoAttachment } from './mediaFilters';

type MediaTypes = 'IMAGE' | 'LINK' | 'VIDEO' | 'DOCUMENT';

const MEDIA_FILTERS = [
    { type: 'IMAGE', filter: hasImageAttachment },
    { type: 'LINK', filter: hasLinkAttachment },
    { type: 'VIDEO', filter: hasVideoAttachment },
    { type: 'DOCUMENT', filter: hasDocumentAttachment },
] as const;

@injectable()
export class MessagesRepository {
    private cleanerWorker = createPrivateChatCleanerWorker();

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
                message.overrideAvatar = Sanitizer.sanitizeImageRef(message.overrideAvatar);
            }

            if (message.overrideName) {
                message.overrideName = message.overrideName.trim();
                message.overrideName = message.overrideName.length > 0 ? message.overrideName : null;
            }

            //
            // Persist Messages
            //
            let privateChat = await Store.ConversationPrivate.findById(ctx, cid);

            Store.ConversationLastSeq.byId(cid).increment(ctx);
            let seq = await Store.ConversationLastSeq.byId(cid).get(ctx);
            let mid = await this.fetchNextMessageId(ctx);
            let messageData = {
                cid: cid,
                uid: uid,
                seq: seq,
                isMuted: message.isMuted || false,
                isService: message.isService || false,
                visibleOnlyForUids: message.visibleOnlyForUids || [],

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
            };
            let msg = await Store.Message.create(ctx, mid, messageData);
            if (privateChat && privateChat.uid1 !== privateChat.uid2) {
                await Store.PrivateMessage.create(ctx, mid, privateChat.uid1, messageData);
                await Store.PrivateMessage.create(ctx, mid, privateChat.uid2, messageData);
            }

            // Precalculate media counters
            for (let filer of MEDIA_FILTERS) {
                if (filer.filter(msg)) {
                    await this.incrementChatMediaCounter(ctx, cid, filer.type);
                }
            }

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
            let messagesToUpdate: (Message | PrivateMessage)[] = [message];

            let privateChat = await Store.ConversationPrivate.findById(ctx, message.cid);
            if (privateChat) {
                let privateCopies = await Promise.all([
                    Store.PrivateMessage.findById(ctx, mid, privateChat.uid1),
                    Store.PrivateMessage.findById(ctx, mid, privateChat.uid2)
                ]);
                messagesToUpdate.push(...privateCopies.filter(isDefined).filter(m => !m.deleted));
            }

            let hadMedias = new Set<MediaTypes>();

            for (let filter of MEDIA_FILTERS) {
                if (filter.filter(message)) {
                    hadMedias.add(filter.type);
                }
            }

            //
            // Update message
            //

            if (newMessage.message) {
                messagesToUpdate.forEach(m => m.text = newMessage.message!);
            }
            if (newMessage.replyMessages) {
                messagesToUpdate.forEach(m => m.replyMessages = newMessage.replyMessages!);
            }
            if (markAsEdited) {
                messagesToUpdate.forEach(m => m.edited = true);
            }
            if (newMessage.attachments)  {
                if (newMessage.appendAttachments) {
                    let attachments = [...(message.attachmentsModern || []), ...await this.prepareAttachments(ctx, newMessage.attachments || [])];
                    messagesToUpdate.forEach(m => m.attachmentsModern = attachments);
                } else {
                    let attachments = await this.prepareAttachments(ctx, newMessage.attachments || []);
                    messagesToUpdate.forEach(m => m.attachmentsModern = attachments);
                }
            }
            if (newMessage.spans) {
                messagesToUpdate.forEach(m => m.spans = newMessage.spans!);
            }
            if (newMessage.serviceMetadata) {
                messagesToUpdate.forEach(m => m.serviceMetadata = newMessage.serviceMetadata!);
            }

            let haveMedias = new Set<MediaTypes>();

            for (let filter of MEDIA_FILTERS) {
                if (filter.filter(message)) {
                    haveMedias.add(filter.type);
                }
            }

            let removedMedia = new Set([...hadMedias].filter(x => !haveMedias.has(x)));
            let addedMedia = new Set([...haveMedias].filter(x => !hadMedias.has(x)));

            let operations = [
                ...[...removedMedia].map(m => ({ type: 'remove', mediaType: m })),
                ...[...addedMedia].map(m => ({ type: 'add', mediaType: m }))
            ];

            for (let operation of operations) {
                messagesToUpdate.forEach(msg => {
                    let incBy = operation.type === 'add' ? 1 : -1;

                    if (msg instanceof PrivateMessage) {
                        Store.ChatMediaCounter.add(ctx, msg.cid, operation.mediaType, msg.inboxUid, incBy);
                    } else {
                        Store.ChatMediaCounter.add(ctx, msg.cid, operation.mediaType, 0, incBy);
                    }
                });
            }
        });
    }

    async deleteMessage(parent: Context, byUid: number, mid: number, oneSide: boolean): Promise<void> {
        await inTx(parent, async (ctx) => {
            let message = (await Store.Message.findById(ctx, mid));
            if (!message || message.deleted) {
                throw new Error('Message not found');
            }

            let privateChat = await Store.ConversationPrivate.findById(ctx, message.cid);
            if (!privateChat && oneSide) {
                throw new UserError('Can\'t delete message only for you in chat room');
            }
            if (!privateChat) {
                message.deleted = true;
                return;
            }

            let msgCopy1 = await Store.PrivateMessage.findById(ctx, mid, privateChat.uid1);
            let msgCopy2 = await Store.PrivateMessage.findById(ctx, mid, privateChat.uid2);

            if (!msgCopy1 || !msgCopy2) {
                return;
            }

            let hadMedias = new Set<MediaTypes>();

            for (let filter of MEDIA_FILTERS) {
                if (filter.filter(message)) {
                    hadMedias.add(filter.type);
                }
            }

            if (oneSide) {
                if (byUid === privateChat.uid1) {
                    msgCopy1.deleted = true;
                } else {
                    msgCopy2.deleted = true;
                }

                for (let mediaType of hadMedias) {
                    await this.decrementChatMediaCounter(ctx, message.cid, mediaType, [byUid]);
                }
            } else {
                msgCopy1.deleted = true;
                msgCopy2.deleted = true;
                message.deleted = true;

                for (let mediaType of hadMedias) {
                    await this.decrementChatMediaCounter(ctx, message.cid, mediaType, []);
                }
            }
        });
    }

    async setReaction(parent: Context, mid: number, uid: number, reaction: string, reset: boolean = false) {
        return await inTx(parent, async (ctx) => {
            reaction = this.toModernReaction(reaction);
            let message = await Store.Message.findById(ctx, mid);

            if (!message) {
                throw new Error('Message not found');
            }

            let messagesToUpdate: (Message | PrivateMessage)[] = [message];

            let privateChat = await Store.ConversationPrivate.findById(ctx, message.cid);
            if (privateChat) {
                let privateCopies = await Promise.all([
                    Store.PrivateMessage.findById(ctx, mid, privateChat.uid1),
                    Store.PrivateMessage.findById(ctx, mid, privateChat.uid2)
                ]);
                messagesToUpdate.push(...privateCopies.filter(isDefined).filter(m => !m.deleted));
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
                reactions.push({userId: uid, reaction});
            }
            messagesToUpdate.forEach(m => m.reactions = reactions);

            return message;
        });
    }

    async getMessagesCount(parent: Context, cid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.ConversationSeq.findById(ctx, cid);
            if (!existing) {
                return 0;
            } else {
                return existing.seq;
            }
        });
    }

    async deletePrivateChatHistory(parent: Context, byUid: number, cid: number, oneSide: boolean) {
        return await inTx(parent, async ctx => {
            let privateChat = await Store.ConversationPrivate.findById(ctx, cid);
            if (!privateChat) {
                throw new NotFoundError();
            }
            if (privateChat.uid1 !== byUid && privateChat.uid2 !== byUid) {
                throw new AccessDeniedError();
            }

            // Clear from primary index
            if (oneSide) {
                Store.PrivateMessage.descriptor.subspace.clearPrefixed(ctx, [cid, byUid]);
            } else {
                Store.PrivateMessage.descriptor.subspace.clearPrefixed(ctx, [cid, privateChat.uid1]);
                Store.PrivateMessage.descriptor.subspace.clearPrefixed(ctx, [cid, privateChat.uid2]);
            }

            // Clear from secondary indexes
            let indexes = Store.PrivateMessage.descriptor.secondaryIndexes;
            for (let index of indexes) {
                if (oneSide) {
                    index.subspace.clearPrefixed(ctx, [cid, byUid]);
                } else {
                    index.subspace.clearPrefixed(ctx, [cid, privateChat.uid1]);
                    index.subspace.clearPrefixed(ctx, [cid, privateChat.uid2]);
                }
            }

            // Clear media counters
            let mediaTypes = ['IMAGE', 'LINK', 'VIDEO', 'DOCUMENT'] as const;
            if (oneSide) {
                mediaTypes.forEach(type => Store.ChatMediaCounter.set(parent, cid, type, byUid, 0));
            } else {
                mediaTypes.forEach(type => {
                    Store.ChatMediaCounter.set(parent, cid, type, privateChat!.uid1, 0);
                    Store.ChatMediaCounter.set(parent, cid, type, privateChat!.uid2, 0);
                });
            }

            // Update documents in elastic
            await this.cleanerWorker.pushWork(ctx, {cid, uid: byUid, oneSide});
        });
    }

    /**
     * @deprecated top message should be persisted in dialog list
     * @param cid conversation id
     */
    async findTopMessage(ctx: Context, cid: number, forUid: number) {
        let res = (await this.fetchMessages(ctx, cid, forUid, {limit: 1, reverse: true})).items;

        if (res.length === 0) {
            return null;
        } else {
            let msg = res[0];
            // this can be slow if we allow hidden messages for users, but ok for service purposes
            // in general we should store top message in user dialogs list & update it via delivery workers
            while (msg.visibleOnlyForUids && msg.visibleOnlyForUids.length > 0 && !msg.visibleOnlyForUids.includes(forUid)) {
                let res2 = (await this.fetchMessages(ctx, cid, forUid, {limit: 1, reverse: true, after: msg.id})).items;
                if (res2.length === 0) {
                    return null;
                }
                msg = res2[0];
            }
            return msg;
        }
    }

    async fetchMessages(ctx: Context, cid: number, forUid: number, opts: RangeQueryOptions<number>) {
        let messages = await this.fetchMessagesRaw(ctx, cid, forUid, opts);
        if (messages.items.length === 0) {
            return messages;
        }
        let after = messages.items[messages.items.length - 1].id;
        messages.items = (messages.items as any).filter((m: any) => (m.visibleOnlyForUids && m.visibleOnlyForUids.length > 0) ? m.visibleOnlyForUids.includes(forUid) : true);

        while (messages.items.length < (opts.limit || 0) && messages.haveMore) {
            let more = await this.fetchMessagesRaw(ctx, cid, forUid, { ...opts, after, limit: 1 });
            // let more = await Store.Message.chat.query(ctx, cid, { ...opts, after, limit: 1 });
            if (more.items.length === 0) {
                messages.haveMore = false;
                return messages;
            }
            after = more.items[more.items.length - 1].id;

            let filtered = (more.items as any).filter((m: any) => (m.visibleOnlyForUids && m.visibleOnlyForUids.length > 0) ? m.visibleOnlyForUids.includes(forUid) : true);
            messages.items.push(...filtered);
            messages.haveMore = more.haveMore;
            messages.cursor = more.cursor;
        }
        if (opts.limit) {
            messages.items = messages.items.slice(0, opts.limit);
        }

        return messages;
    }

    async fetchMessagesWithAttachments(ctx: Context, cid: number, forUid: number, type: MediaTypes, opts: RangeQueryOptions<number>) {
        const mediaTypeToIndex = {
            IMAGE: Store.Message.hasImageAttachment,
            VIDEO: Store.Message.hasVideoAttachment,
            DOCUMENT: Store.Message.hasDocumentAttachment,
            LINK: Store.Message.hasLinkAttachment
        };
        const mediaTypeToIndexPrivate = {
            IMAGE: Store.PrivateMessage.hasImageAttachment,
            VIDEO: Store.PrivateMessage.hasVideoAttachment,
            DOCUMENT: Store.PrivateMessage.hasDocumentAttachment,
            LINK: Store.PrivateMessage.hasLinkAttachment
        };

        if (!USE_NEW_PRIVATE_CHATS) {
            return mediaTypeToIndex[type].query(ctx, cid, opts);
        }
        let privateChat = await Store.ConversationPrivate.findById(ctx, cid);
        if (!privateChat) {
            return mediaTypeToIndex[type].query(ctx, cid, opts);
        }

        return mediaTypeToIndexPrivate[type].query(ctx, cid, forUid, opts);
    }

    async fetchConversationNextSeq(parent: Context, cid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.ConversationSeq.findById(ctx, cid);
            let seq = 1;
            if (!existing) {
                await (await Store.ConversationSeq.create(ctx, cid, {seq: 1})).flush(ctx);
            } else {
                seq = ++existing.seq;
                await existing.flush(ctx);
            }
            return seq;
        });
    }

    async incrementChatMediaCounter(parent: Context, cid: number, mediaType: MediaTypes) {
        let conv = await Store.Conversation.findById(parent, cid);
        if (!conv) {
            return;
        }
        if (conv.kind === 'room') {
            Store.ChatMediaCounter.add(parent, cid, mediaType, 0, 1);
        } else if (conv.kind === 'private') {
            let privateConv = await Store.ConversationPrivate.findById(parent, cid);
            if (!privateConv) {
                return;
            }
            Store.ChatMediaCounter.add(parent, cid, mediaType, privateConv.uid1, 1);
            Store.ChatMediaCounter.add(parent, cid, mediaType, privateConv.uid2, 1);
            Store.ChatMediaCounter.add(parent, cid, mediaType, 0, 1);
        }
    }

    async decrementChatMediaCounter(parent: Context, cid: number, mediaType: MediaTypes, forUids: number[]) {
        let conv = await Store.Conversation.findById(parent, cid);
        if (!conv) {
            return;
        }

        if (conv.kind === 'room') {
            Store.ChatMediaCounter.add(parent, cid, mediaType, 0, -1);
        } else if (conv.kind === 'private') {
            let privateConv = await Store.ConversationPrivate.findById(parent, cid);
            if (!privateConv) {
                return;
            }
            if (forUids.length === 0) {
                forUids = [privateConv.uid1, privateConv.uid2];
            }

            for (let uid of forUids) {
                Store.ChatMediaCounter.add(parent, cid, mediaType, uid, -1);
            }
        }
    }

    private async fetchNextMessageId(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let ex = await Store.Sequence.findById(ctx, 'message-id');
            if (ex) {
                let res = ++ex.value;
                await ex.flush(ctx);
                return res;
            } else {
                await Store.Sequence.create(ctx, 'message-id', {value: 1});
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
        return reactions.map(reaction => ({
            userId: reaction.userId,
            reaction: this.toModernReaction(reaction.reaction)
        }));
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

    private async fetchMessagesRaw(ctx: Context, cid: number, forUid: number, opts: RangeQueryOptions<number>) {
        if (!USE_NEW_PRIVATE_CHATS) {
            return await Store.Message.chat.query(ctx, cid, opts);
        }

        let privateChat = await Store.ConversationPrivate.findById(ctx, cid);
        if (!privateChat || privateChat.uid1 === privateChat.uid2) {
            return await Store.Message.chat.query(ctx, cid, opts);
        } else {
            return await Store.PrivateMessage.chat.query(ctx, cid, forUid, opts);
        }
    }
}
