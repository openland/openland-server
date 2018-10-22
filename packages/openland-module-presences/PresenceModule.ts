import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import Timer = NodeJS.Timer;
import { createIterator } from '../openland-server/utils/asyncIterator';
import { Pubsub } from '../openland-server/modules/pubsub';

export interface OnlineEvent {
    userId: number;
    timeout: number;
    online: boolean;
}

export class PresenceModule {
    private onlines = new Map<number, { online: boolean, timer?: Timer }>();
    private fdbSubscriptions = new Map<number, { cancel: () => void }>();
    // private localSub = new SimpleSub<number, OnlineEvent>();
    private localSub = new Pubsub<OnlineEvent>(false);

    start = () => {
        // Nothing to do
    }

    async setOnline(uid: number, tid: string, timeout: number, platform: string) {
        return await inTx(async () => {
            let expires = Date.now() + timeout;
            let ex = await FDB.Presence.findById(uid, tid);
            if (ex) {
                ex.lastSeen = Date.now();
                ex.lastSeenTimeout = timeout;
                ex.platform = platform;
            } else {
                await FDB.Presence.create(uid, tid, { lastSeen: Date.now(), lastSeenTimeout: timeout, platform });
            }

            let online = await FDB.Online.findById(uid);

            if (!online) {
                await FDB.Online.create(uid, { lastSeen: expires });
            } else if (online.lastSeen < expires) {
                online.lastSeen = expires;
            }
        });
    }

    async getLastSeen(uid: number) {
        let res = await FDB.Online.findById(uid);

        if (res) {
            if (res.lastSeen > Date.now()) {
                return 'online';
            } else {
                return res.lastSeen;
            }
        } else {
            return 'never_online';
        }
    }

    public async createPresenceIterator(uid: number, users: number[]) {

        users = Array.from(new Set(users)); // remove duplicates

        let subscriptions: { unsubscribe: () => void }[] = [];
        let iterator = createIterator<OnlineEvent>(() => subscriptions.forEach(s => s.unsubscribe()));

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

            subscriptions.push((await this.localSub.xSubscribe(userId.toString(10), ev => {
                iterator.push(ev);
            })));
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
                await this.localSub.publish(userId.toString(10), { userId, timeout: 0, online: false });
                this.onlines.set(userId, { online: false });
            }, timeout);
            this.onlines.set(userId, { online, timer });

        } else {
            this.onlines.set(userId, { online });
        }

        if (isChanged) {
            await this.localSub.publish(userId.toString(10), { userId, timeout, online });
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