import { FDB } from './FDB';
import { inTx } from 'foundation-orm/inTx';

export class Online {
    async setOnline(uid: number, tid: number, timeout: number, platform: string) {
        return await inTx(async () => {
            let expires = Date.now() + timeout;
            FDB.Presence.createOrUpdate(uid, tid, { lastSeen: Date.now(), lastSeenTimeout: timeout, platform });

            let online = await FDB.Online.findById(uid);

            if (!online) {
                FDB.Online.createOrUpdate(uid, { lastSeen: expires });
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

(async () => {

    async function watch() {
        let w = await FDB.Presence.watch(31, 806);

        console.log(w.value);
        w.promise.then(r => {
            console.log('change', r);
            watch();
        });
    }

    watch();

})();