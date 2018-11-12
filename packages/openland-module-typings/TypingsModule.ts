import { createIterator } from 'openland-utils/asyncIterator';
import { TypingEvent } from './TypingEvent';
import { PubsubSubcription, Pubsub } from 'openland-module-pubsub/pubsub';
import { debouncer } from 'openland-utils/timer';
import { Modules } from 'openland-modules/Modules';
import { injectable } from 'inversify';

@injectable()
export class TypingsModule {

    private TIMEOUT = 2000;
    private debounce = debouncer(this.TIMEOUT);
    private cache = new Map<number, number[]>();
    private xPubSub = new Pubsub<TypingEvent>();

    start = () => {
        setInterval(() => this.cache.clear(), 1000 * 30);
    }

    public async setTyping(uid: number, conversationId: number, type: string) {
        this.debounce(conversationId, async () => {
            let members = await this.getChatMembers(conversationId);

            for (let member of members) {
                // tslint:disable-next-line:no-floating-promises
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
            // tslint:disable-next-line:no-floating-promises
            this.xPubSub.publish(`TYPING_${member}`, {
                forUserId: member,
                userId: uid,
                conversationId: conversationId,
                type: 'cancel',
                cancel: true
            });
        }
    }

    public async createTypingStream(uid: number, conversationId?: number) {

        let sub: PubsubSubcription | undefined;

        let iterator = createIterator<TypingEvent>(() => sub ? sub.cancel() : {});

        sub = await this.xPubSub.subscribe(`TYPING_${uid}`, ev => {
            if (conversationId && ev.conversationId !== conversationId) {
                return;
            }

            iterator.push(ev);
        });

        return iterator;
    }

    private async getChatMembers(chatId: number): Promise<number[]> {
        if (this.cache.has(chatId)) {
            return this.cache.get(chatId)!;
        } else {
            let members = await Modules.Messaging.room.findConversationMembers(chatId);

            this.cache.set(chatId, members);

            return members;
        }
    }
}