import { Pubsub } from '../modules/pubsub';
import { DB } from '../tables';
import { backoff, forever, delayBreakable } from '../utils/timer';
import sequelize from 'sequelize';
import { addAfterChangedCommitHook } from '../utils/sequelizeHooks';

const pubsub = new Pubsub<{ chatId: number, seq: number }>();

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

export class ChatsRepository {

    reader: ChatsEventReader;

    constructor() {
        this.reader = new ChatsEventReader();
        pubsub.subscribe('chat_events', (event) => {
            this.reader.onMessage(event.chatId, event.seq);
        });
        this.startReader();
        addAfterChangedCommitHook(DB.ConversationEvent, (event) => {
            pubsub.publish('chat_events', { chatId: event.conversationId, seq: event.seq });
        });
    }

    private async startReader() {
        let firstEvent = await backoff(async () => DB.ConversationEvent.find({
            order: [['createdAt', 'desc'], ['id', 'desc']]
        }));
        let offset: { id: number, date: Date } | null = null;
        if (firstEvent) {
            offset = { id: firstEvent.id, date: firstEvent.createdAt };
        }
        let breaker: (() => void) | null = null;
        pubsub.subscribe('chat_events', (event) => {
            if (breaker) {
                breaker();
                breaker = null;
            }
        });
        forever(async () => {
            let where = (offset
                ? sequelize.literal(`("createdAt" >= '${offset.date.toISOString()}') AND (("createdAt" > '${offset.date.toISOString()}') OR ("conversation_events"."id" > ${offset.id}))`) as any
                : {});
            let events = await DB.ConversationEvent.findAll({
                where: where,
                order: [['createdAt', 'asc'], ['id', 'asc']],
                limit: 100
            });
            if (events.length > 0) {
                offset = { id: events[events.length - 1].id, date: events[events.length - 1].createdAt };
                for (let e of events) {
                    this.reader.onMessage(e.conversationId, e.seq);
                }
                let res = delayBreakable(1000);
                breaker = res.resolver;
                await res.promise;
                breaker = null;
            } else {
                let res = delayBreakable(5000);
                breaker = res.resolver;
                await res.promise;
                breaker = null;
            }
        });
    }
}