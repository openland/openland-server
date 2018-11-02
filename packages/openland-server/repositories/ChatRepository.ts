import { DB } from '../tables';
import { Transaction } from 'sequelize';
import { JsonMap } from '../utils/json';
import { NotFoundError } from '../errors/NotFoundError';
import { Repos } from './index';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { Conversation } from '../tables/Conversation';
import { URLAugmentation } from '../services/UrlInfoService';
import { CacheRepository } from 'openland-module-cache/CacheRepository';
import { Modules } from 'openland-modules/Modules';
// import { createLogger } from 'openland-log/createLogger';
import { withTracing } from 'openland-log/withTracing';
import { createTracer } from 'openland-log/createTracer';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { ConversationEvent } from 'openland-module-db/schema';
// import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';

// const log = createLogger('messaging-legacy');
const tracer = createTracer('messaging-legacy');
// const messageSent = createHyperlogger<{ cid: number }>('message_sent');
// const messageReceived = createHyperlogger<{ cid: number }>('message_received');

export type ChatEventType =
    'new_message' |
    'delete_message' |
    'title_change' |
    'new_members' |
    'kick_member' |
    'update_role' |
    'edit_message' |
    'chat_update';

export type UserEventType =
    'new_message' |
    'delete_message' |
    'conversation_read' |
    'title_change' |
    'new_members_count' |
    'edit_message' |
    'chat_update';

export type ServiceMessageMetadataType =
    'user_invite' |
    'user_kick' |
    'title_change' |
    'photo_change';

export interface Message {
    message?: string | null;
    file?: string | null;
    fileMetadata?: JsonMap | null;
    filePreview?: string | null;
    isMuted?: boolean | null;
    isService?: boolean | null;
    repeatKey?: string | null;
    serviceMetadata?: any & { type: ServiceMessageMetadataType };
    urlAugmentation?: URLAugmentation | null | false;
    replyMessages?: number[] | null;
    mentions?: number[] | null;
}

export interface Settings {
    mobileNotifications: 'all' | 'direct' | 'none';
    mute: boolean;
    id: string;
}

export class ChatsRepository {
    draftsCache = new CacheRepository<{ message: string }>('message_draft');

    loadPrivateChat = async (uid1: number, uid2: number) => {
        let _uid1 = Math.min(uid1, uid2);
        let _uid2 = Math.max(uid1, uid2);
        return await DB.txStable(async (tx) => {
            let conversation = await DB.Conversation.find({
                where: {
                    member1Id: _uid1,
                    member2Id: _uid2,
                    type: 'private'
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });
            if (conversation) {
                return conversation;
            }
            let res = await DB.Conversation.create({
                type: 'private',
                title: 'Private Chat',
                member1Id: _uid1,
                member2Id: _uid2
            });
            return res;
        });
    }

    loadOrganizationalChat = async (oid1: number, oid2: number, exTx?: Transaction) => {
        let _oid1 = Math.min(oid1, oid2);
        let _oid2 = Math.max(oid1, oid2);
        return await DB.txStable(async (tx) => {
            let conversation = await DB.Conversation.find({
                where: {
                    organization1Id: _oid1,
                    organization2Id: _oid2,
                    type: 'shared'
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });
            if (conversation) {
                return conversation;
            }
            let res = await DB.Conversation.create({
                type: 'shared',
                title: 'Cross Organization Chat',
                organization1Id: _oid1,
                organization2Id: _oid2
            }, { transaction: tx });
            return res;
        }, exTx);
    }

    async messageToText(message: Message) {
        let parts: string[] = [];

        if (message.message) {
            parts.push(message.message);
        }
        if (message.file) {
            if (message.fileMetadata && message.fileMetadata.isImage) {
                parts.push('<image>');
            } else {
                parts.push('<file>');
            }
        }

        return parts.join('\n');
    }

    async sendMessage(conversationId: number, uid: number, message: Message): Promise<ConversationEvent> {
        return await withTracing(tracer, 'send_message', async () => {
            return await inTx(async () => {
                if (message.message === 'fuck') {
                    throw Error('');
                }

                let conv = await DB.Conversation.findById(conversationId);
                if (!conv) {
                    throw new NotFoundError('Conversation not found');
                }

                //
                // Check access
                //
                await this.checkAccessToChat(uid, conv);

                // 
                // Persist Messages
                //
                let mid = await Modules.Messaging.repo.fetchNextMessageId();
                await FDB.Message.create(mid, {
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

                let seq = await Modules.Messaging.repo.fetchConversationNextSeq(conversationId);
                let res = await FDB.ConversationEvent.create(conversationId, seq, {
                    kind: 'message_received',
                    mid: mid
                });
                await Modules.Drafts.clearDraft(uid, conversationId);
                await Modules.Messaging.DeliveryWorker.pushWork({ messageId: mid });
                return res;
            });
        });
    }

    async editMessage(tx: Transaction, messageId: number, uid: number, newMessage: Message, markAsEdited: boolean): Promise<ConversationEvent> {
        return await inTx(async () => {
            let message = await FDB.Message.findById(messageId);

            if (!message) {
                throw new Error('Message not found');
            }

            if (message.uid !== uid) {
                throw new AccessDeniedError();
            }

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

            let members = await this.getConversationMembers(message.cid, tx);
            for (let member of members) {
                let global = await Modules.Messaging.repo.getUserMessagingState(member);
                global.seq++;
                await FDB.UserDialogEvent.create(member, global.seq, {
                    kind: 'message_updated',
                    mid: message!.id
                });
            }

            let seq = await Modules.Messaging.repo.fetchConversationNextSeq(message!.cid);
            let res = await FDB.ConversationEvent.create(message!.cid, seq, {
                kind: 'message_updated',
                mid: message!.id
            });

            await Modules.Messaging.AugmentationWorker.pushWork({ messageId: message.id });

            return res;
        });
    }

    async setReaction(messageId: number, uid: number, reaction: string, reset: boolean = false) {
        return await inTx(async () => {
            let message = await FDB.Message.findById(messageId);

            if (!message) {
                throw new Error('Message not found');
            }

            let reactions: { reaction: string, userId: number }[] = message.reactions as any || [];
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

            let members = await this.getConversationMembers(message!.cid);
            for (let member of members) {
                let global = await Modules.Messaging.repo.getUserMessagingState(member);
                global.seq++;
                await FDB.UserDialogEvent.create(member, global.seq, {
                    kind: 'message_updated',
                    mid: message!.id
                });
            }

            let seq = await Modules.Messaging.repo.fetchConversationNextSeq(message!.cid);
            return await FDB.ConversationEvent.create(message!.cid, seq, {
                kind: 'message_updated',
                mid: message!.id
            });
        });
    }

    async deleteMessage(tx: Transaction, messageId: number, uid: number): Promise<ConversationEvent> {
        return await inTx(async () => {
            let message = await FDB.Message.findById(messageId);

            if (!message) {
                throw new Error('Message not found');
            }

            if (message.uid !== uid) {
                if (await Repos.Permissions.superRole(uid) !== 'super-admin') {
                    throw new AccessDeniedError();
                }
            }

            //
            // Delete message
            //

            message.deleted = true;

            //
            //  Update counters
            //

            let members = await this.getConversationMembers(message.cid, tx);
            for (let member of members) {

                let existing = await Modules.Messaging.repo.getUserDialogState(member, message!.cid);
                let global = await Modules.Messaging.repo.getUserMessagingState(member);

                if (member !== uid) {
                    if (!existing.readMessageId || existing.readMessageId < message!.id) {
                        existing.unread--;
                        global.unread--;
                        global.seq++;

                        await FDB.UserDialogEvent.create(member, global.seq, {
                            kind: 'message_read',
                            cid: message!.cid,
                            unread: existing.unread,
                            allUnread: global.unread
                        });
                    }
                }

                global.seq++;
                await FDB.UserDialogEvent.create(member, global.seq, {
                    kind: 'message_deleted',
                    mid: message!.id
                });
            }

            let seq = await Modules.Messaging.repo.fetchConversationNextSeq(message!.cid);
            return await FDB.ConversationEvent.create(message!.cid, seq, {
                kind: 'message_deleted',
                mid: message!.id
            });
        });
    }

    async getConversationMembersFast(conversationId: number, conv: Conversation, tx?: Transaction): Promise<number[]> {
        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }

        let members: number[] = [];

        if (conv.type === 'private') {
            members = [conv.member1Id!!, conv.member2Id!!];
        } else if (conv.type === 'shared') {
            let m = await DB.OrganizationMember.findAll({
                where: {
                    orgId: {
                        $in: [conv.organization1Id!!, conv.organization2Id!!]
                    }
                },
                order: [['createdAt', 'DESC']],
                transaction: tx,
            });
            for (let i of m) {
                if (members.indexOf(i.userId) < 0) {
                    members.push(i.userId);
                }
            }
        } else if (conv.type === 'group') {
            let m = await DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId: conv.id,
                },
                transaction: tx,
            });
            for (let i of m) {
                if (members.indexOf(i.userId) < 0) {
                    members.push(i.userId);
                }
            }
        } else if (conv.type === 'channel') {
            let m = await DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId: conv.id,
                    status: 'member'
                },
                transaction: tx,
            });
            for (let i of m) {
                if (members.indexOf(i.userId) < 0) {
                    members.push(i.userId);
                }
            }

            // let orgs = await DB.ConversationChannelMembers.findAll({
            //     where: {
            //         conversationId: conv.id,
            //         status: 'member'
            //     },
            //     transaction: tx
            // });
            //
            // for (let org of orgs) {
            //     let orgMembers = await Repos.Organizations.getOrganizationMembers(org.orgId);
            //
            //     for (let member of orgMembers) {
            //         members.push(member.userId);
            //     }
            // }
        }

        return members;
    }

    async getConversationMembers(conversationId: number, eTx?: Transaction): Promise<number[]> {
        return DB.txStable(async (tx) => {
            let conv = await DB.Conversation.findById(conversationId, { transaction: tx });

            if (!conv) {
                throw new NotFoundError('Conversation not found');
            }

            let members: number[] = [];

            if (conv.type === 'private') {
                members = [conv.member1Id!!, conv.member2Id!!];
            } else if (conv.type === 'shared') {
                let m = await DB.OrganizationMember.findAll({
                    where: {
                        orgId: {
                            $in: [conv.organization1Id!!, conv.organization2Id!!]
                        }
                    },
                    order: [['createdAt', 'DESC']],
                    transaction: tx,
                });
                for (let i of m) {
                    if (members.indexOf(i.userId) < 0) {
                        members.push(i.userId);
                    }
                }
            } else if (conv.type === 'group') {
                let m = await DB.ConversationGroupMembers.findAll({
                    where: {
                        conversationId: conv.id,
                    },
                    transaction: tx,
                });
                for (let i of m) {
                    if (members.indexOf(i.userId) < 0) {
                        members.push(i.userId);
                    }
                }
            } else if (conv.type === 'channel') {
                let m = await DB.ConversationGroupMembers.findAll({
                    where: {
                        conversationId: conv.id,
                        status: 'member'
                    },
                    transaction: tx,
                });
                for (let i of m) {
                    if (members.indexOf(i.userId) < 0) {
                        members.push(i.userId);
                    }
                }
            }

            return members;
        }, eTx);
    }

    async groupChatExists(conversationId: number): Promise<boolean> {
        return !!await DB.Conversation.findOne({
            where: {
                id: conversationId,
                type: 'group'
            }
        });
    }

    async membersCountInConversation(conversationId: number, status?: string): Promise<number> {
        return await DB.ConversationGroupMembers.count({
            where: {
                conversationId: conversationId,
                status: status || 'member'
            }
        });
    }

    async getConversationSec(conversationId: number, exTx?: Transaction): Promise<number> {
        return await DB.txStable(async (tx) => {
            let conv = await DB.Conversation.findById(conversationId, { lock: tx.LOCK.UPDATE, transaction: tx });
            if (!conv) {
                throw new NotFoundError('Conversation not found');
            }

            return conv.seq;
        }, exTx);
    }

    async addToInitialChannel(uid: number, tx: Transaction) {
        // let channelId = IDs.Conversation.parse('EQvPJ1LaODSWXZ3xJ0P5CybWBL');
        // await Repos.Chats.addToChannel(tx, channelId, uid);
    }

    async addToChannel(tx: Transaction, channelId: number, uid: number) {
        let profile = await Modules.Users.profileById(uid);
        // no profile - user not signed up
        if (!profile) {
            return;
        }
        let firstName = profile!!.firstName;
        let existing = await DB.ConversationGroupMembers.find({
            where: {
                conversationId: channelId,
                userId: uid,
            },
            transaction: tx,
        });
        if (existing) {
            if (existing.status === 'member') {
                return;
            } else {
                existing.status = 'member';
                await existing.save({ transaction: tx });
            }
        } else {
            await DB.ConversationGroupMembers.create({
                conversationId: channelId,
                invitedById: uid,
                role: 'member',
                status: 'member',
                userId: uid,
            }, { transaction: tx });
        }

        await Repos.Chats.sendMessage(
            channelId,
            uid,
            {
                message: `${firstName} has joined the channel!`,
                isService: true,
                isMuted: true,
                serviceMetadata: {
                    type: 'user_invite',
                    userIds: [uid],
                    invitedById: uid
                }
            }
        );
    }

    async getConversationTitle(conversationId: number, oid: number | undefined, uid: number): Promise<string> {
        let conv = await DB.Conversation.findById(conversationId);

        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }

        if (conv.type === 'private') {
            let _uid;
            if (conv.member1Id === uid || (conv.member1 && conv.member1.id === uid)) {
                _uid = conv.member2Id!!;
            } else if (conv.member2Id === uid || (conv.member2 && conv.member2.id === uid)) {
                _uid = conv.member1Id!!;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await Modules.Users.profileById(_uid))!;
            return [profile.firstName, profile.lastName].filter((v) => !!v).join(' ');
        } else if (conv.type === 'shared') {
            if (conv.organization1Id === oid || (conv.organization1 && conv.organization1.id === oid)) {
                return (conv.organization2 || await conv.getOrganization2())!!.name!;
            } else if (conv.organization2Id === oid || (conv.organization2 && conv.organization2.id === oid)) {
                return (conv.organization1 || await conv.getOrganization1())!!.name!;
            } else {
                let org1 = (conv.organization1 || await conv.getOrganization2())!!;
                let org2 = (conv.organization2 || await conv.getOrganization2())!!;
                if (org1.id === org2.id) {
                    return org1.name!;
                }
                return org1.name + ', ' + org2.name;
            }
        } else if (conv.type === 'group') {
            if (conv.title !== '') {
                return conv.title;
            }
            let res = await DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId: conv.id,
                    userId: {
                        $not: uid
                    }
                },
                order: ['userId']
            });
            let name: string[] = [];
            for (let r of res) {
                let p = (await Modules.Users.profileById(r.userId))!!;
                name.push([p.firstName, p.lastName].filter((v) => !!v).join(' '));
            }
            return name.join(', ');
        } else if (conv.type === 'channel') {
            return conv.title;
        }

        throw new Error('Unknown chat type');
    }

    async checkAccessToChat(uid: number, conversation: Conversation) {
        if (conversation.type === 'channel' || conversation.type === 'group') {
            if (!(await DB.ConversationGroupMembers.findOne({ where: { conversationId: conversation.id, userId: uid } }))) {
                throw new AccessDeniedError();
            }
        }
    }
}