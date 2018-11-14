import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import Timer = NodeJS.Timer;
import { createIterator } from '../openland-utils/asyncIterator';
import { Pubsub, PubsubSubcription } from '../openland-module-pubsub/pubsub';
import { AllEntities } from '../openland-module-db/schema';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';
import { injectable } from 'inversify';
import { createLogger } from 'openland-log/createLogger';

const presenceEvent = createHyperlogger<{ uid: number, online: boolean }>('presence');
const log = createLogger('presences');

export interface OnlineEvent {
    userId: number;
    timeout: number;
    online: boolean;
}

@injectable()
export class PresenceModule {
    private onlines = new Map<number, { online: boolean, timer?: Timer }>();
    private fdbSubscriptions = new Map<number, { cancel: () => void }>();
    private localSub = new Pubsub<OnlineEvent>(false);
    private FDB: AllEntities = FDB;

    start = (fdb?: AllEntities) => {
        // Nothing to do
        if (fdb) {
            this.FDB = fdb;
        }
    }

    public async setOnline(uid: number, tid: string, timeout: number, platform: string) {
        return await inTx(async () => {
            let expires = Date.now() + timeout;
            let ex = await this.FDB.Presence.findById(uid, tid);
            if (ex) {
                ex.lastSeen = Date.now();
                ex.lastSeenTimeout = timeout;
                ex.platform = platform;
            } else {
                await this.FDB.Presence.create(uid, tid, { lastSeen: Date.now(), lastSeenTimeout: timeout, platform });
            }

            let online = await this.FDB.Online.findById(uid);

            if (!online) {
                await this.FDB.Online.create(uid, { lastSeen: expires });
            } else if (online.lastSeen < expires) {
                online.lastSeen = expires;
            }

            await presenceEvent.event({ uid, online: true });
        });
    }

    public async getLastSeen(uid: number): Promise<'online' | 'never_online' | number> {
        log.debug('get last seen');
        let res = await this.FDB.Online.findById(uid);
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

    public async createPresenceStream(uid: number, users: number[]): Promise<AsyncIterable<OnlineEvent>> {

        users = Array.from(new Set(users)); // remove duplicates

        let subscriptions: PubsubSubcription[] = [];
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

            subscriptions.push(await this.localSub.subscribe(userId.toString(10), iterator.push));
        }

        return iterator;
    }

    private async handleOnlineChange(userId: number) {
        let onlineValue = await this.FDB.Online.findById(userId);

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
            let sub = this.FDB.Online.watch(uid, () => {
                log.debug('presence watch fired for ' + uid);
                // tslint:disable-next-line:no-floating-promises
                this.handleOnlineChange(uid);
            });
            this.fdbSubscriptions.set(uid, sub);
        }
    }
}