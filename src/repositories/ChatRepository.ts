import { DB } from '../tables';
import { SuperBus } from '../modules/SuperBus';
import { ConversationEventAttributes, ConversationEvent } from '../tables/ConversationEvent';
import { ConversationUserGlobal } from '../tables/ConversationsUserGlobal';
import { ConversationMessageAttributes } from '../tables/ConversationMessage';
import { ConversationUserEvents, ConversationUserEventsAttributes } from '../tables/ConversationUserEvents';

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

export class ChatsRepository {

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
}