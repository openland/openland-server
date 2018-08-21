import { DB } from '../tables';
import { SuperBus } from '../modules/SuperBus';
import { ConversationEventAttributes, ConversationEvent } from '../tables/ConversationEvent';
import { ConversationUserGlobal } from '../tables/ConversationsUserGlobal';
import { ConversationMessageAttributes } from '../tables/ConversationMessage';
import { ConversationUserEvents, ConversationUserEventsAttributes } from '../tables/ConversationUserEvents';
import { Transaction } from 'sequelize';
import { JsonMap } from '../utils/json';
import { DoubleInvokeError } from '../errors/DoubleInvokeError';
import { NotFoundError } from '../errors/NotFoundError';
import { debouncer } from '../utils/timer';
import { Repos } from './index';
import { Pubsub } from '../modules/pubsub';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { ImageRef } from './Media';

export type ChatEventType =
    'new_message' |
    'title_change' |
    'new_members' |
    'kick_member' |
    'update_role';

export type UserEventType =
    'new_message' |
    'conversation_read' |
    'title_change' |
    'new_members_count';

export type ServiceMessageMetadataType =
    'user_invite' |
    'user_kick' |
    'title_change';

export interface Message {
    message?: string | null;
    file?: string | null;
    fileMetadata?: JsonMap | null;
    isMuted?: boolean | null;
    isService?: boolean | null;
    repeatKey?: string | null;
    serviceMetadata?: any & { type: ServiceMessageMetadataType };
    urlAugmentation?: any & { url: string, title?: string, date?: string, subtitle?: string, description?: string, photo?: ImageRef };
}

class ChatsEventReader {
    private knownHeads = new Map<number, number>();
    private pending = new Map<number, ((seq: number) => void)[]>();

    onMessage = (chatId: number, seq: number) => {
        if (this.knownHeads.has(chatId)) {
            let esec = this.knownHeads.get(chatId)!!;
            if (esec < seq) {
                this.knownHeads.set(chatId, seq);
                this.notify(chatId, seq);
            }
        } else {
            this.knownHeads.set(chatId, seq);
            this.notify(chatId, seq);
        }
    }

    loadNext = (chatId: number, seq: number | null, callback: (seq: number) => void) => {
        if (seq !== null) {
            if (this.knownHeads.has(chatId)) {
                let cseq = this.knownHeads.get(chatId)!!;
                if (cseq > seq) {
                    callback(cseq);
                    return;
                }
            }
        }
        if (!this.pending.has(chatId)) {
            this.pending.set(chatId, []);
        }
        this.pending.get(chatId)!!.push(callback);
    }

    private notify = (chatId: number, seq: number) => {
        console.warn('[' + chatId + ']: ' + seq);
        if (this.pending.has(chatId)) {
            let callbacks = this.pending.get(chatId)!!;
            if (callbacks.length > 0) {
                let cb = [...callbacks];
                this.pending.set(chatId, []);
                for (let c of cb) {
                    c(seq);
                }
            }
        }
    }
}

class ChatCounterListener {
    private received = new Map<number, { date: number, counter: number }>();
    private pending = new Map<number, ((counter: number) => void)[]>();

    onMessage(uid: number, date: number, counter: number) {
        let changed = false;
        if (this.received.has(uid)) {
            let existing = this.received.get(uid)!!;
            if (existing.date < date && existing.counter !== counter) {
                changed = true;
                this.received.set(uid, { date: date, counter: counter });
            }
        } else {
            changed = true;
            this.received.set(uid, { date: date, counter: counter });
        }
        if (changed) {
            let callbacks = this.pending.get(uid);
            if (callbacks && callbacks.length > 0) {
                let cb = [...callbacks];
                this.pending.set(uid, []);
                for (let c of cb) {
                    c(counter);
                }
            }
        }
    }

    loadNext = async (uid: number) => {
        if (!this.pending.has(uid)) {
            this.pending.set(uid, []);
        }
        return new Promise<number>((resolve) => this.pending.get(uid)!!.push(resolve));
    }
}

class UserEventsReader {
    private knownHeads = new Map<number, number>();
    private pending = new Map<number, ((seq: number) => void)[]>();

    onMessage(userId: number, seq: number) {
        let isUpdated = false;
        if (this.knownHeads.has(userId)) {
            let currentSeq = this.knownHeads.get(userId)!!;
            if (currentSeq < seq) {
                isUpdated = true;
                this.knownHeads.set(userId, seq);
            }
        } else {
            isUpdated = true;
            this.knownHeads.set(userId, seq);
        }
        if (isUpdated) {
            if (this.pending.has(userId)) {
                let callbacks = this.pending.get(userId)!!;
                if (callbacks.length > 0) {
                    let cb = [...callbacks];
                    this.pending.set(userId, []);
                    for (let c of cb) {
                        c(seq);
                    }
                }
            }
        }
    }

    loadNext = async (userId: number, seq: number | null) => {
        if (seq !== null) {
            if (this.knownHeads.has(userId)) {
                let cseq = this.knownHeads.get(userId)!!;
                if (cseq > seq) {
                    return cseq;
                }
            }
        }
        if (!this.pending.has(userId)) {
            this.pending.set(userId, []);
        }
        return await new Promise<number>((resolver) => this.pending.get(userId)!!.push(resolver));
    }
}

export interface TypingEvent {
    forUserId: number;
    userId: number;
    conversationId: number;
    type: string;
    cancel: boolean;
}

class TypingManager {
    public TIMEOUT = 2000;

    private debounce = debouncer(this.TIMEOUT);

    private cache = new Map<number, number[]>();

    private typingState = new Map<number, boolean>();

    private xPubSub = new Pubsub<TypingEvent>();

    public async setTyping(uid: number, conversationId: number, type: string) {
        this.debounce(conversationId, async () => {
            this.typingState.set(uid, true);
            setTimeout(() => this.typingState.delete(uid), this.TIMEOUT);
            let members = await this.getChatMembers(conversationId);

            for (let member of members) {
                this.xPubSub.publish(`TYPING_${member}`, {
                    forUserId: member,
                    userId: uid,
                    conversationId: conversationId,
                    type,
                    cancel: false
                });
            }
        });
    }

    public async cancelTyping(uid: number, conversationId: number) {
        if (!this.typingState.has(uid)) {
            return;
        }

        let members = await this.getChatMembers(conversationId);

        for (let member of members) {
            this.xPubSub.publish(`TYPING_${member}`, {
                forUserId: member,
                userId: uid,
                conversationId: conversationId,
                type: 'cancel',
                cancel: true
            });
        }
    }

    public resetCache(charId: number) {
        this.cache.delete(charId);
    }

    public async getXIterator(uid: number, conversationId?: number) {

        let events: TypingEvent[] = [];
        let resolvers: any[] = [];

        let sub = await this.xPubSub.xSubscribe(`TYPING_${uid}`, ev => {
            if (conversationId && ev.conversationId !== conversationId) {
                return;
            }

            if (resolvers.length > 0) {
                resolvers.shift()({ value: ev, done: false });
            } else {
                events.push(ev);
            }
        });

        const getValue = () => {
            return new Promise((resolve => {
                if (events.length > 0) {
                    let val = events.shift();

                    resolve({
                        value: val,
                        done: false
                    });
                } else {
                    resolvers.push(resolve);
                }
            }));
        };

        return {
            next(): any {
                return getValue();
            },
            return(): any {
                events = [];
                resolvers = [];
                sub.unsubscribe();
                return Promise.resolve({ value: undefined, done: true });
            },
            throw(error: any) {
                return Promise.reject(error);
            },
            [Symbol.asyncIterator]() {
                return this;
            }
        };
    }

    private async getChatMembers(chatId: number): Promise<number[]> {
        if (this.cache.has(chatId)) {
            return this.cache.get(chatId)!;
        } else {
            let members = await Repos.Chats.getConversationMembers(chatId);

            this.cache.set(chatId, members);

            return members;
        }
    }
}

export class ChatsRepository {
    typingManager = new TypingManager();
    reader: ChatsEventReader;
    counterReader: ChatCounterListener;
    userReader: UserEventsReader;
    eventsSuperbus: SuperBus<{ chatId: number, seq: number }, ConversationEvent, Partial<ConversationEventAttributes>>;
    countersSuperbus: SuperBus<{ userId: number, counter: number, date: number }, ConversationUserGlobal, Partial<ConversationMessageAttributes>>;
    userSuperbus: SuperBus<{ userId: number, seq: number }, ConversationUserEvents, Partial<ConversationUserEventsAttributes>>;

    constructor() {
        this.reader = new ChatsEventReader();
        this.counterReader = new ChatCounterListener();
        this.userReader = new UserEventsReader();

        this.eventsSuperbus = new SuperBus('chat_events_all', DB.ConversationEvent, 'conversation_events');
        this.eventsSuperbus.eventBuilder((v) => ({ chatId: v.conversationId, seq: v.seq }));
        this.eventsSuperbus.eventHandler((v) => this.reader.onMessage(v.chatId, v.seq));
        this.eventsSuperbus.start();

        this.countersSuperbus = new SuperBus('notification_counters', DB.ConversationsUserGlobal, 'conversation_user_global');
        this.countersSuperbus.eventBuilder((v) => ({ userId: v.userId, counter: v.unread, date: v.updatedAt.getTime() }));
        this.countersSuperbus.eventHandler((v) => this.counterReader.onMessage(v.userId, v.date, v.counter));
        this.countersSuperbus.start();

        this.userSuperbus = new SuperBus('user_events', DB.ConversationUserEvents, 'conversation_user_event');
        this.userSuperbus.eventBuilder((v) => ({ userId: v.userId, seq: v.seq }));
        this.userSuperbus.eventHandler((v) => this.userReader.onMessage(v.userId, v.seq));
        this.userSuperbus.start();
    }

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

    async sendMessage(tx: Transaction, conversationId: number, uid: number, message: Message): Promise<{ conversationEvent: ConversationEvent, userEvent: ConversationUserEvents }> {
        if (message.message === 'fuck') {
            throw Error('');
        }

        await this.typingManager.cancelTyping(uid, conversationId);

        //
        // Handle retry
        //

        if (message.repeatKey) {
            if (await DB.ConversationMessage.find({
                where: {
                    userId: uid,
                    conversationId: conversationId,
                    repeatToken: message.repeatKey
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            })) {
                throw new DoubleInvokeError();
            }
        }

        let conv = await DB.Conversation.findById(conversationId, { lock: tx.LOCK.UPDATE, transaction: tx });
        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }

        //
        // Check access
        //
        let blocked;
        if (conv.type === 'private') {
            blocked = await DB.ConversationBlocked.findOne({ where: { user: uid, blockedBy: uid === conv.member1Id ? conv.member2Id : conv.member1Id, conversation: null } });
        } else {
            blocked = await DB.ConversationBlocked.findOne({ where: { user: uid, conversation: conversationId } });
        }
        if (blocked) {
            throw new AccessDeniedError();
        }

        //
        // Increment sequence number
        //

        let seq = conv.seq + 1;
        conv.seq = seq;
        await conv.save({ transaction: tx });

        // 
        // Persist Messages
        //

        let msg = await DB.ConversationMessage.create({
            message: message.message,
            fileId: message.file,
            fileMetadata: message.fileMetadata,
            conversationId: conversationId,
            userId: uid,
            repeatToken: message.repeatKey,
            isMuted: message.isMuted || false,
            isService: message.isService || false,
            extras: {
                serviceMetadata: message.serviceMetadata || {},
                ...message.urlAugmentation ? { urlAugmentation: message.urlAugmentation } : {},
            }
        }, { transaction: tx });
        let res = await DB.ConversationEvent.create({
            conversationId: conversationId,
            eventType: 'new_message',
            event: {
                messageId: msg.id
            },
            seq: seq
        }, { transaction: tx });

        //
        // Unread Counters
        //
        let members = await this.getConversationMembers(conversationId, tx);

        let userEvent: ConversationUserEvents;

        if (members.length > 0) {
            let currentStates = await DB.ConversationUserState.findAll({
                where: {
                    conversationId: conversationId,
                    userId: {
                        $in: members
                    }
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });
            let currentGlobals = await DB.ConversationsUserGlobal.findAll({
                where: {
                    userId: {
                        $in: members
                    }
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });
            for (let m of members) {
                let existing = currentStates.find((v) => v.userId === m);
                let existingGlobal = currentGlobals.find((v) => v.userId === m);
                let userSeq = 1;
                let userUnread = 0;
                let userChatUnread = 0;

                // Write user's chat state
                if (m !== uid) {
                    if (existing) {
                        existing.unread++;
                        userChatUnread = existing.unread;
                        await existing.save({ transaction: tx });
                    } else {
                        userChatUnread = 1;
                        await DB.ConversationUserState.create({
                            conversationId: conversationId,
                            userId: m,
                            unread: 1
                        }, { transaction: tx });
                    }
                } else {
                    if (existing) {
                        (existing as any).changed('updatedAt', true);
                        await existing.save({ transaction: tx });
                    } else {
                        await DB.ConversationUserState.create({
                            conversationId: conversationId,
                            userId: m,
                            unread: 0
                        }, { transaction: tx });
                    }
                }

                // Update or Create global state
                if (existingGlobal) {
                    if (m !== uid) {
                        existingGlobal.unread++;
                    }
                    existingGlobal.seq++;
                    userSeq = existingGlobal.seq;
                    userUnread = existingGlobal.unread;
                    await existingGlobal.save({ transaction: tx });
                } else {
                    if (m !== uid) {
                        userUnread = 1;
                        await DB.ConversationsUserGlobal.create({
                            userId: m,
                            unread: 1,
                            seq: 1,
                            hasUnnoticedUnread: true,
                        }, { transaction: tx });
                    } else {
                        userUnread = 0;
                        await DB.ConversationsUserGlobal.create({
                            userId: m,
                            unread: 0,
                            seq: 1,
                            hasUnnoticedUnread: false,
                        }, { transaction: tx });
                    }
                }

                // Write User Event
                let _userEvent = await DB.ConversationUserEvents.create({
                    userId: m,
                    seq: userSeq,
                    eventType: 'new_message',
                    event: {
                        conversationId: conversationId,
                        messageId: msg.id,
                        unreadGlobal: userUnread,
                        unread: userChatUnread,
                        senderId: uid,
                        repeatKey: message.repeatKey ? message.repeatKey : null
                    }
                }, { transaction: tx });

                if (m === uid) {
                    userEvent = _userEvent;
                }
            }
        }

        return {
            conversationEvent: res,
            userEvent: userEvent!
        };
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
                    transaction: tx
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
                    transaction: tx
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
                    transaction: tx
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

    async addChatEvent(conversationId: number, eventType: ChatEventType, event: JsonMap, exTx?: Transaction): Promise<ConversationEvent> {
        return await DB.txStable(async (tx) => {
            let conv = await DB.Conversation.findById(conversationId, { lock: tx.LOCK.UPDATE, transaction: tx });
            if (!conv) {
                throw new NotFoundError('Conversation not found');
            }
            let seq = conv.seq + 1;
            conv.seq = seq;
            await conv.save({ transaction: tx });

            return await DB.ConversationEvent.create({
                conversationId: conversationId,
                eventType: eventType,
                event,
                seq: seq
            }, { transaction: tx });
        }, exTx);
    }

    async addUserEvent(userId: number, eventType: UserEventType, event: JsonMap, exTx?: Transaction): Promise<ConversationUserEvents> {
        return await DB.txStable(async (tx) => {
            let seq = await this.userEventsSeqInc(userId, exTx);

            return await DB.ConversationUserEvents.create({
                userId,
                seq,
                eventType: eventType,
                event,
            }, { transaction: tx });
        }, exTx);
    }

    async addUserEventsInConversation(conversationId: number, userId: number, eventType: UserEventType, event: JsonMap, exTx?: Transaction): Promise<ConversationUserEvents> {
        let members = await this.getConversationMembers(conversationId);

        let userEvent: ConversationUserEvents;

        for (let member of members) {
            let ev = await this.addUserEvent(member, eventType, event, exTx);

            if (member === userId) {
                userEvent = ev;
            }
        }

        return userEvent!;
    }

    async userEventsSeqInc(userId: number, exTx?: Transaction): Promise<number> {
        return await DB.txStable(async (tx) => {
            let userSeq = 1;

            let currentGlobal = await DB.ConversationsUserGlobal.findOne({
                where: {
                    userId
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });

            if (currentGlobal) {
                currentGlobal.seq++;
                userSeq = currentGlobal.seq;
                await currentGlobal.save({ transaction: tx });
            }

            return userSeq;
        }, exTx);
    }

    async blockUser(tx: Transaction, userId: number, blockedBy: number, conversation?: number) {
        let user = DB.User.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        let existing = await DB.ConversationBlocked.findOne({ where: { user: userId, ...(conversation ? { blockedBy: blockedBy } : { conversation: conversation }) }, transaction: tx });
        if (existing) {
            return;
        }
        await DB.ConversationBlocked.create({
            user: userId,
            blockedBy: blockedBy,
            conversation: conversation
        }, { transaction: tx });
    }

    async membersCountInConversation(conversationId: number): Promise<number> {
        return await DB.ConversationGroupMembers.count({
            where: {
                conversationId: conversationId,
            }
        });
    }
}