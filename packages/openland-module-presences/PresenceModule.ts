import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { OnlineEngine } from './OnlineEngine';

export class PresenceModule {
    readonly engine = new OnlineEngine();

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
}