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
import { Pubsub, PubsubSubcription } from '../modules/pubsub';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { ConversationMessagesWorker } from '../workers';
import { IDs } from '../api/utils/IDs';
import { Perf } from '../utils/perf';
import { Conversation } from '../tables/Conversation';
import { URLAugmentation } from '../services/UrlInfoService';
import Timer = NodeJS.Timer;
import { CacheRepository } from 'openland-repositories/CacheRepository';
import { Modules } from 'openland-modules/Modules';
import { FDB } from '../../openland-module-db/FDB';
import { SimpleSub } from '../modules/SimpleSub';

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
    urlAugmentation?: URLAugmentation | null;
    replyMessages?: number[] | null;
    mentions?: number[] | null;
}

export interface Settings {
    mobileNotifications: 'all' | 'direct' | 'none';
    mute: boolean;
    id: string;
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

class SubscriptionEngine<T> {
    private events: T[] = [];
    private resolvers: any[] = [];

    constructor(
        private onExit: () => void
    ) {

    }

    pushEvent(event: T) {
        if (this.resolvers.length > 0) {
            this.resolvers.shift()({
                value: event,
                done: false
            });
        } else {
            this.events.push(event);
        }
    }

    getIterator() {
        const getValue = () => {
            return new Promise((resolve => {
                if (this.events.length > 0) {
                    let val = this.events.shift();

                    resolve({
                        value: val,
                        done: false
                    });
                } else {
                    this.resolvers.push(resolve);
                }
            }));
        };

        let onReturn = () => {
            this.events = [];
            this.resolvers = [];
            this.onExit();
            return Promise.resolve({ value: undefined, done: true });
        };

        return {
            next(): any {
                return getValue();
            },
            return: onReturn,
            throw(error: any) {
                return Promise.reject(error);
            },
            [Symbol.asyncIterator]() {
                return this;
            }
        };
    }
}

class TypingManager {
    public TIMEOUT = 2000;

    private debounce = debouncer(this.TIMEOUT);

    private cache = new Map<number, number[]>();

    private xPubSub = new Pubsub<TypingEvent>();

    constructor() {
        setInterval(() => this.cache.clear(), 1000 * 30);
    }

    public async setTyping(uid: number, conversationId: number, type: string) {
        this.debounce(conversationId, async () => {
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

    public async cancelTyping(uid: number, conversationId: number, members: number[]) {
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

        let sub: PubsubSubcription | undefined;

        let subEng = new SubscriptionEngine<TypingEvent>(() => sub ? sub.unsubscribe() : {});

        sub = await this.xPubSub.xSubscribe(`TYPING_${uid}`, ev => {
            if (conversationId && ev.conversationId !== conversationId) {
                return;
            }

            subEng.pushEvent(ev);
        });

        return subEng.getIterator();
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

export interface OnlineEventInternal {
    userId: number;
    timeout: number;
    online: boolean;
}

export class OnlineEngine {
    private xPubSub = new Pubsub<OnlineEventInternal>(false);
    private pubSubGlobal = new Pubsub<OnlineEventInternal>();
    private cache = new Map<number, number[]>();
    private onlines = new Map<number, { online: boolean, timer?: Timer }>();

    constructor() {
        setInterval(() => this.cache.clear(), 1000 * 30);

        this.pubSubGlobal.subscribe('ONLINE', async (ev) => {
            if (ev.online) {
                let prev = this.onlines.get(ev.userId);

                let isChanged = !prev || !prev.online;

                if (prev && prev.timer) {
                    clearTimeout(prev.timer);
                }
                let timer = setTimeout(async () => {
                    await this.xPubSub.publish(
                        'ONLINE_' + ev.userId,
                        {
                            userId: ev.userId,
                            timeout: 0,
                            online: false
                        }
                    );
                    this.onlines.set(ev.userId, { online: false });

                }, ev.timeout);
                this.onlines.set(ev.userId, { online: true, timer });

                if (isChanged) {
                    await this.xPubSub.publish(
                        'ONLINE_' + ev.userId,
                        {
                            userId: ev.userId,
                            timeout: ev.timeout,
                            online: true
                        }
                    );
                }
            } else {
                let prev = this.onlines.get(ev.userId);

                let isChanged = prev && prev.online;

                if (prev && prev.timer) {
                    clearTimeout(prev.timer);
                }
                this.onlines.set(ev.userId, { online: false });

                if (isChanged) {
                    await this.xPubSub.publish(
                        'ONLINE_' + ev.userId,
                        {
                            userId: ev.userId,
                            timeout: 0,
                            online: false
                        }
                    );
                }
            }
        });
    }

    async setOnline(uid: number, timeout: number) {
        await this.pubSubGlobal.publish(
            'ONLINE',
            {
                userId: uid,
                timeout,
                online: true
            }
        );
    }

    async setOffline(uid: number) {
        await this.pubSubGlobal.publish(
            'ONLINE',
            {
                userId: uid,
                timeout: 0,
                online: false
            }
        );
    }

    public async getXIterator(uid: number, conversations?: number[], users?: number[]) {

        let members: number[] = users || [];

        if (conversations) {
            for (let chat of conversations) {
                members.push(...await this.getChatMembers(chat));
            }
        }

        members = Array.from(new Set(members)); // remove duplicates

        let subscriptions: PubsubSubcription[] = [];
        let sub = new SubscriptionEngine(() => subscriptions.forEach(s => s.unsubscribe()));

        let genEvent = (ev: OnlineEventInternal) => {
            return {
                type: ev.online ? 'online' : 'offline',
                timeout: ev!.timeout,
                userId: ev!.userId,
            };
        };

        // Send initial state
        for (let member of members) {
            if (this.onlines.get(member)) {
                let online = this.onlines.get(member)!;
                sub.pushEvent(genEvent({
                    userId: member,
                    timeout: online.online ? 5000 : 0,
                    online: online.online
                }));
            }
        }

        for (let member of members) {
            subscriptions.push(await this.xPubSub.xSubscribe('ONLINE_' + member, (ev: OnlineEventInternal) => {
                sub.pushEvent(genEvent(ev));
            }));
        }

        return sub.getIterator();
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

export class OnlineEngineNew {
    private cache = new Map<number, number[]>();
    private onlines = new Map<number, { online: boolean, timer?: Timer }>();
    private fdbSubscriptions = new Map<number, { cancel: () => void }>();
    private localSub = new SimpleSub<number, OnlineEventInternal>();

    constructor() {
        setInterval(() => this.cache.clear(), 1000 * 30);
    }

    async setOnline(uid: number, timeout: number) {
        // console.log('setOnline');
    }

    async setOffline(uid: number) {
        // console.log('setOffline');
    }

    async fSubscribe(uid: number) {
        if (this.fdbSubscriptions.has(uid)) {
            return;
        } else {
            let sub = FDB.Online.watch(uid, () => {
                this.handleOnlineChange(uid);
            });
            this.fdbSubscriptions.set(uid, sub);
        }
    }

    public async getXIterator(uid: number, conversations?: number[], users?: number[]) {

        let members: number[] = users || [];

        if (conversations) {
            for (let chat of conversations) {
                members.push(...await this.getChatMembers(chat));
            }
        }

        members = Array.from(new Set(members)); // remove duplicates

        let subscriptions: { cancel: () => void }[] = [];
        let sub = new SubscriptionEngine(() => subscriptions.forEach(s => s.cancel()));

        let genEvent = (ev: OnlineEventInternal) => {
            return {
                type: ev.online ? 'online' : 'offline',
                timeout: ev!.timeout,
                userId: ev!.userId,
            };
        };

        // Send initial state
        for (let member of members) {
            if (this.onlines.get(member)) {
                let online = this.onlines.get(member)!;
                sub.pushEvent(genEvent({
                    userId: member,
                    timeout: online.online ? 5000 : 0,
                    online: online.online
                }));
            }
        }

        for (let member of members) {
            await this.fSubscribe(member);

            subscriptions.push(this.localSub.subscribe(member, ev => {
                sub.pushEvent(genEvent(ev));
            }));
        }

        return sub.getIterator();
    }

    private async handleOnlineChange(userId: number) {
        let onlineValue = await FDB.Online.findById(userId);

        let timeout = 0;
        let isOnline = false;

        if (onlineValue) {
            if (onlineValue.lastSeen > Date.now()) {
                isOnline = true;
                timeout = onlineValue.lastSeen - Date.now();
            }
        }

        if (isOnline) {
            let prev = this.onlines.get(userId);

            let isChanged = !prev || !prev.online;

            if (prev && prev.timer) {
                clearTimeout(prev.timer);
            }
            let timer = setTimeout(async () => {
                this.localSub.emit(userId, {
                    userId: userId,
                    timeout: timeout,
                    online: false
                });
                this.onlines.set(userId, { online: false });

            }, timeout);
            this.onlines.set(userId, { online: true, timer });

            if (isChanged) {
                this.localSub.emit(userId, {
                    userId: userId,
                    timeout: timeout,
                    online: true
                });
            }
        } else {
            let prev = this.onlines.get(userId);

            let isChanged = prev && prev.online;

            if (prev && prev.timer) {
                clearTimeout(prev.timer);
            }
            this.onlines.set(userId, { online: false });

            if (isChanged) {
                this.localSub.emit(userId, {
                    userId: userId,
                    timeout: timeout,
                    online: false
                });
            }
        }
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

    draftsCache = new CacheRepository<{ message: string }>('message_draft');
    onlineEngine = new OnlineEngineNew();

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

    async sendMessage(tx: Transaction, conversationId: number, uid: number, message: Message): Promise<{ conversationEvent: ConversationEvent, userEvent: ConversationUserEvents }> {
        let perf = new Perf('sendMessage');

        perf.start('sendMessage');

        if (message.message === 'fuck') {
            throw Error('');
        }

        //
        // Handle retry
        //
        perf.start('Handle retry');
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
        perf.end('Handle retry');

        perf.start('conv');
        let conv = await DB.Conversation.findById(conversationId, {
            lock: tx.LOCK.UPDATE,
            transaction: tx
        });
        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }
        perf.end('conv');

        //
        // Check access
        //
        perf.start('Check access');
        await this.checkAccessToChat(uid, conv, tx);
        perf.end('Check access');

        //
        // Increment sequence number
        //

        perf.start('Increment sequence number');
        let seq = conv.seq + 1;
        // conv.seq = seq;
        // await conv.save({ transaction: tx });

        await conv.increment('seq', { transaction: tx });
        perf.end('Increment sequence number');

        // 
        // Persist Messages
        //

        perf.start('Persist Messages');
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
                ...message.urlAugmentation ? { urlAugmentation: message.urlAugmentation as any } : {},
                ...message.replyMessages ? { replyMessages: message.replyMessages } : {},
                filePreview: message.filePreview || null,
                plainText: await this.messageToText(message),
                ...message.mentions ? { mentions: message.mentions } : {}
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
        perf.end('Persist Messages');
        //
        // Unread Counters
        //

        perf.start('getConversationMembers');
        // let members = await this.getConversationMembers(conversationId, tx);
        let members = await this.getConversationMembersFast(conversationId, conv, tx);
        perf.end('getConversationMembers');

        await this.typingManager.cancelTyping(uid, conversationId, members);

        let userEvent: ConversationUserEvents;

        if (members.length > 0) {
            perf.start('currentStates');
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
            perf.end('currentStates');
            perf.start('currentGlobals');
            let currentGlobals = await DB.ConversationsUserGlobal.findAll({
                where: {
                    userId: {
                        $in: members
                    }
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });
            perf.end('currentGlobals');
            perf.start('membersEvents');
            for (let m of members) {
                let existing = currentStates.find((v) => v.userId === m);
                let existingGlobal = currentGlobals.find((v) => v.userId === m);
                let userSeq = 1;
                let userUnread = 0;
                let userChatUnread = 0;

                // let muted = (await this.getConversationSettings(m, conversationId)).mute;

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

                 await Modules.Push.sendCounterPush(m, conversationId, userUnread, tx);

                if (m === uid) {
                    userEvent = _userEvent;
                }
            }
            perf.end('membersEvents');
        }

        perf.start('ConversationMessagesWorker');
        await ConversationMessagesWorker.pushWork({ messageId: msg.id }, tx);
        perf.end('ConversationMessagesWorker');

        await this.deleteDraftMessage(uid, conversationId);

        perf.end('sendMessage');

        perf.print();

        return {
            conversationEvent: res,
            userEvent: userEvent!
        };
    }

    async editMessage(tx: Transaction, messageId: number, uid: number, newMessage: Message, markAsEdited: boolean): Promise<ConversationEvent> {
        let message = await DB.ConversationMessage.findById(messageId, { transaction: tx });

        if (!message) {
            throw new Error('Message not found');
        }

        if (message.userId !== uid) {
            throw new AccessDeniedError();
        }

        if (newMessage.message) {
            message.message = newMessage.message;
        }
        if (newMessage.file) {
            message.fileId = newMessage.file;
        }
        if (newMessage.fileMetadata) {
            (message as any).changed('fileMetadata', true);
            message.fileMetadata = newMessage.fileMetadata;
        }
        if (newMessage.filePreview) {
            (message as any).changed('extras', true);
            message.extras.filePreview = newMessage.filePreview;
        }
        if (newMessage.replyMessages) {
            (message as any).changed('extras', true);
            message.extras.replyMessages = newMessage.replyMessages;
        }
        if (newMessage.urlAugmentation || newMessage.urlAugmentation === null) {
            (message as any).changed('extras', true);
            message.extras.urlAugmentation = newMessage.urlAugmentation as any;
        }
        if (newMessage.mentions) {
            (message as any).changed('extras', true);
            message.extras.mentions = newMessage.mentions;
        }

        if (markAsEdited) {
            (message as any).changed('extras', true);
            message.extras.edited = true;
        }

        (message as any).changed('extras', true);
        message.extras.plainText = await this.messageToText(newMessage);

        console.log(message.extras);

        await message.save({ transaction: tx });

        await ConversationMessagesWorker.pushWork({ messageId: message.id }, tx);

        await Repos.Chats.addUserEventsInConversation(
            message.conversationId,
            uid,
            'edit_message',
            {
                messageId: message.id
            },
            tx
        );

        return await Repos.Chats.addChatEvent(
            message.conversationId,
            'edit_message',
            {
                messageId: message.id
            },
            tx
        );
    }

    async setReaction(tx: Transaction, messageId: number, uid: number, reaction: string, reset: boolean = false) {
        let message = await DB.ConversationMessage.findById(messageId, { transaction: tx });

        if (!message) {
            throw new Error('Message not found');
        }

        let reactions: { reaction: string, userId: number }[] = message.extras.reactions as any || [];

        if (reactions.find(r => (r.userId === uid) && (r.reaction === reaction))) {
            if (reset) {
                reactions = reactions.filter(r => !((r.userId === uid) && (r.reaction === reaction)));
            } else {
                return;

            }
        } else {
            reactions.push({ userId: uid, reaction });
        }

        message.extras.reactions = reactions;
        (message as any).changed('extras', true);

        await message.save({ transaction: tx });

        await Repos.Chats.addUserEventsInConversation(
            message.conversationId,
            uid,
            'edit_message',
            {
                messageId: message.id
            },
            tx
        );

        return await Repos.Chats.addChatEvent(
            message.conversationId,
            'edit_message',
            {
                messageId: message.id
            },
            tx
        );
    }

    async deleteMessage(tx: Transaction, messageId: number, uid: number): Promise<ConversationEvent> {
        let message = await DB.ConversationMessage.findById(messageId, { transaction: tx });

        if (!message) {
            throw new Error('Message not found');
        }

        if (message.userId !== uid) {
            if (await Repos.Permissions.superRole(uid) !== 'super-admin') {
                throw new AccessDeniedError();
            }
        }

        //
        //  Update counters
        //

        let members = await this.getConversationMembers(message.conversationId, tx);

        for (let member of members) {
            if (member === uid) {
                continue;
            }

            let existing = await DB.ConversationUserState.find({
                where: {
                    userId: member,
                    conversationId: message.conversationId
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });
            let existingGlobal = await DB.ConversationsUserGlobal.find({
                where: {
                    userId: member
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });

            if (!existing || !existingGlobal) {
                throw Error('Internal inconsistency');
            }

            if (existing.readDate < message.id) {
                existing.unread--;
                existingGlobal.unread--;
                existingGlobal.seq++;
                await existing.save({ transaction: tx });
                await existingGlobal.save({ transaction: tx });

                await DB.ConversationUserEvents.create({
                    seq: existingGlobal.seq,
                    userId: member,
                    eventType: 'conversation_read',
                    event: {
                        conversationId: message.conversationId,
                        unread: existing.unread,
                        unreadGlobal: existingGlobal.unread
                    }
                }, { transaction: tx });
            }
        }

        //
        // Delete message
        //

        await message.destroy();
        await Repos.Chats.addUserEventsInConversation(
            message.conversationId,
            uid,
            'delete_message',
            {
                messageId: message.id
            },
            tx
        );

        return await Repos.Chats.addChatEvent(
            message.conversationId,
            'delete_message',
            {
                messageId: message.id
            },
            tx
        );
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

    async membersCountInConversation(conversationId: number, status?: string): Promise<number> {
        return await DB.ConversationGroupMembers.count({
            where: {
                conversationId: conversationId,
                status: status || 'member'
            }
        });
    }

    async getConversationSettings(uid: number, cid: number, tx?: Transaction) {
        let res = await DB.ConversationUserState.find({ where: { userId: uid, conversationId: cid }, transaction: tx });
        let settings: Settings = {
            mobileNotifications: 'all',
            mute: false,
            id: IDs.ConversationSettings.serialize(cid)
        };
        if (res) {
            if (res.notificationsSettings.mobileNotifications) {
                settings.mobileNotifications = res.notificationsSettings.mobileNotifications as any;
            }
            if (res.notificationsSettings.mute) {
                settings.mute = res.notificationsSettings.mute as any;
            }
        }
        return settings;
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
        let profile = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx });
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
            tx,
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
            let profile = (await DB.UserProfile.find({
                where: {
                    userId: _uid
                }
            }))!!;
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
                let p = (await DB.UserProfile.find({ where: { userId: r.userId } }))!!;
                name.push([p.firstName, p.lastName].filter((v) => !!v).join(' '));
            }
            return name.join(', ');
        } else if (conv.type === 'channel') {
            return conv.title;
        }

        throw new Error('Unknown chat type');
    }

    async getDraftMessage(uid: number, conversationId: number) {
        return this.draftsCache.read(`${uid}_${conversationId}`);
    }

    async saveDraftMessage(uid: number, conversationId: number, message: string) {
        return this.draftsCache.write(`${uid}_${conversationId}`, { message });
    }

    async deleteDraftMessage(uid: number, conversationId: number) {
        return this.draftsCache.write(`${uid}_${conversationId}`, { message: '' });
    }

    async checkAccessToChat(uid: number, conversation: Conversation, tx: Transaction) {
        let blocked;
        if (conversation.type === 'private') {
            blocked = await DB.ConversationBlocked.findOne({ where: { user: uid, blockedBy: uid === conversation.member1Id ? conversation.member2Id : conversation.member1Id, conversation: null } });
        } else {
            blocked = await DB.ConversationBlocked.findOne({ where: { user: uid, conversation: conversation.id } });
        }
        if (blocked) {
            throw new AccessDeniedError();
        }

        if (conversation.type === 'channel' || conversation.type === 'group') {
            if (!(await DB.ConversationGroupMembers.findOne({ where: { conversationId: conversation.id, userId: uid }, transaction: tx }))) {
                throw new AccessDeniedError();
            }
        }
    }

    async pinMessage(tx: Transaction, uid: number, conversationId: number, messageId: number | undefined) {
        let conv = await DB.Conversation.findById(conversationId, {
            lock: tx.LOCK.UPDATE,
            transaction: tx
        });
        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }
        if (conv.type !== 'channel' && conv.type !== 'group') {
            throw new NotFoundError();
        }
        await this.checkAccessToChat(uid, conv, tx);

        let prev = conv.extras && conv.extras.pinnedMessage || undefined;

        if (prev !== messageId) {
            conv.extras.pinnedMessage = messageId || null;
            (conv as any).changed('extras', true);
            await conv.save({ transaction: tx });

            await Repos.Chats.addChatEvent(
                conversationId,
                'chat_update',
                {},
                tx
            );

            await Repos.Chats.addUserEventsInConversation(
                conversationId,
                uid,
                'chat_update',
                {
                    conversationId
                },
                tx
            );

            await conv.reload({ transaction: tx });
        }

        return {
            chat: conv,
            curSeq: conv.seq
        };
    }
}