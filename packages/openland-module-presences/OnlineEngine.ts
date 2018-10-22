import { SimpleSub } from '../openland-server/modules/SimpleSub';
import { FDB } from '../openland-module-db/FDB';
import { Repos } from '../openland-server/repositories';
import { OnlineEventInternal } from '../openland-server/repositories/ChatRepository';
import Timer = NodeJS.Timer;
import { XAsyncIterator } from '../openland-server/modules/XAsyncIterator';

export class OnlineEngine {
    private cache = new Map<number, number[]>();
    private onlines = new Map<number, { online: boolean, timer?: Timer }>();
    private fdbSubscriptions = new Map<number, { cancel: () => void }>();
    private localSub = new SimpleSub<number, OnlineEventInternal>();

    constructor() {
        setInterval(() => this.cache.clear(), 1000 * 30);
    }

    async fSubscribe(uid: number) {
        if (this.fdbSubscriptions.has(uid)) {
            return;
        } else {
            // tslint:disable-next-line:no-floating-promises
            let sub = FDB.Online.watch(uid, () => {
                // tslint:disable-next-line:no-floating-promises
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
        let sub = new XAsyncIterator(() => subscriptions.forEach(s => s.cancel()));

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
            FDB.Online.watch(uid, () => {
                // tslint:disable-next-line:no-floating-promises
                this.handleOnlineChange(uid);
            });

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
                    timeout: 0,
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