import { fTx } from './FTransaction';

export interface OnlineRecord {
    lastSeen: number;
    lastSeenTimeout: number;
    platform: string;
}

export class Online {
    async setOnline(uid: number, tid: number, timeout: number, platform: string) {
        return await fTx(async (tx) => {
            let expires = Date.now() + timeout;
            await tx.set(['presence', uid, tid], { lastSeen: Date.now(), lastSeenTimeout: timeout, platform });

            let online = await tx.get(['online', uid]);

            if (!online || online.lastSeen  < expires) {
                await tx.set(['online', uid], { lastSeen: expires });
            }
        });
    }

    async getLastSeen(uid: number) {
        return await fTx(async (tx) => {
            let res = await tx.get(['online', uid]);

            if (res) {
                if (res.lastSeen > Date.now()) {
                    return 'online';
                } else {
                    return res.lastSeen;
                }
            } else {
                return 'never_online';
            }
        });
    }
}