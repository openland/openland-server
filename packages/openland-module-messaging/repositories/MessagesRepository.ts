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
                messagesToUpdate.push(...privateCopies.filter(isDefined));
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
            if (newMessage.attachments) {
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

            if (oneSide) {
                if (byUid === privateChat.uid1) {
                    msgCopy1.deleted = true;
                } else {
                    msgCopy2.deleted = true;
                }
            } else {
                msgCopy1.deleted = true;
                msgCopy2.deleted = true;
                message.deleted = true;
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
            message.reactions = reactions;

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

            // Update documents in elastic
            await this.cleanerWorker.pushWork(ctx, {cid, uid: byUid, oneSide});
        });
    }

    /**
     * @deprecated top message should be persisted in dialog list
     * @param cid conversation id
     */
    async findTopMessage(ctx: Context, cid: number, forUid: number) {
        let isPrivateChat = !!(await Store.ConversationPrivate.findById(ctx, cid));

        let res;
        if (isPrivateChat) {
            res = (await Store.PrivateMessage.chat.query(ctx, cid, forUid, {limit: 1, reverse: true})).items;
        } else {
            res = (await Store.Message.chat.query(ctx, cid, {limit: 1, reverse: true})).items;
        }

        if (res.length === 0) {
            return null;
        } else {
            let msg = res[0];
            // this can be slow if we allow hidden messages for users, but ok for service purposes
            // in general we should store top message in user dialogs list & update it via delivery workers
            while (msg.visibleOnlyForUids && msg.visibleOnlyForUids.length > 0 && !msg.visibleOnlyForUids.includes(forUid)) {
                let res2;
                if (isPrivateChat) {
                    res2 = (await Store.PrivateMessage.chat.query(ctx, cid, forUid, {
                        limit: 1,
                        reverse: true,
                        after: msg.id
                    })).items;
                } else {
                    res2 = (await Store.Message.chat.query(ctx, cid, {limit: 1, reverse: true, after: msg.id})).items;
                }
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
                await (await Store.ConversationSeq.create(ctx, cid, {seq: 1})).flush(ctx);
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
}
