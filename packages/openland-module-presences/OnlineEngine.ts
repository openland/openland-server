import { SimpleSub } from '../openland-server/modules/SimpleSub';
import { FDB } from '../openland-module-db/FDB';
import Timer = NodeJS.Timer;
import { createIterator } from '../openland-server/utils/asyncIterator';

export interface OnlineEvent {
    userId: number;
    timeout: number;
    online: boolean;
}

export class OnlineEngine {
    private onlines = new Map<number, { online: boolean, timer?: Timer }>();
    private fdbSubscriptions = new Map<number, { cancel: () => void }>();
    private localSub = new SimpleSub<number, OnlineEvent>();

    public async createPresenceIterator(uid: number, users: number[]) {

        users = Array.from(new Set(users)); // remove duplicates

        let subscriptions: { cancel: () => void }[] = [];
        let iterator = createIterator<OnlineEvent>(() => subscriptions.forEach(s => s.cancel()));

        // Send initial state
        for (let userId of users) {
            if (this.onlines.get(userId)) {
                let online = this.onlines.get(userId)!;
                iterator.push({
                    userId,
                    timeout: online.online ? 5000 : 0,
                    online: online.online
                });
            }
        }

        for (let userId of users) {
            await this.subscribeOnlineChange(userId);

            subscriptions.push(this.localSub.subscribe(userId, ev => {
                iterator.push(ev);
            }));
        }

        return iterator;
    }

    private async handleOnlineChange(userId: number) {
        let onlineValue = await FDB.Online.findById(userId);

        let timeout = 0;
        let online = false;

        if (onlineValue && onlineValue.lastSeen > Date.now()) {
            online = true;
            timeout = onlineValue.lastSeen - Date.now();
        }

        let prev = this.onlines.get(userId);

        let isChanged = online ? (!prev || !prev.online) : (prev && prev.online);

        if (prev && prev.timer) {
            clearTimeout(prev.timer);
        }

        if (online) {
            let timer = setTimeout(async () => {
                this.localSub.emit(userId, { userId, timeout: 0, online: false });
                this.onlines.set(userId, { online: false });
            }, timeout);
            this.onlines.set(userId, { online, timer });

        } else {
            this.onlines.set(userId, { online });
        }

        if (isChanged) {
            this.localSub.emit(userId, { userId, timeout, online });
        }
    }

    private async subscribeOnlineChange(uid: number) {
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
}