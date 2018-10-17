import { inTx } from './modules/FTransaction';
import { SFoundation } from './modules/SFoundation';

export interface OnlineRecord {
    lastSeen: number;
    lastSeenTimeout: number;
    platform: string;
}

export class Online {
    private presense = new SFoundation<{ lastSeen: number, lastSeenTimeout: number, platform: string }>('presence');
    private online = new SFoundation<{ lastSeen: number }>('online');

    async setOnline(uid: number, tid: number, timeout: number, platform: string) {
        return await inTx(async () => {
            let expires = Date.now() + timeout;
            await this.presense.set({ lastSeen: Date.now(), lastSeenTimeout: timeout, platform }, uid, tid);

            let online = await this.online.get(uid);

            if (!online || online.lastSeen < expires) {
                await this.online.set({ lastSeen: expires }, uid);
            }
        });
    }

    async getLastSeen(uid: number) {
        return await inTx(async () => {
            let res = await this.online.get(uid);

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