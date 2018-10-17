import { inTx } from './modules/FTransaction';
import { SEntity } from './modules/SEntity';

export interface OnlineRecord {
    lastSeen: number;
    lastSeenTimeout: number;
    platform: string;
}

export class Online {
    private presense = new SEntity<{ lastSeen: number, lastSeenTimeout: number, platform: string }>('presence');
    private online = new SEntity<{ lastSeen: number }>('online');

    async setOnline(uid: number, tid: number, timeout: number, platform: string) {
        return await inTx(async () => {
            let expires = Date.now() + timeout;
            await this.presense.createOrUpdate({ lastSeen: Date.now(), lastSeenTimeout: timeout, platform }, uid, tid);

            let online = await this.online.getById(uid);

            if (!online || online.value.lastSeen < expires) {
                await this.online.createOrUpdate({ lastSeen: expires }, uid);
            }
        });
    }

    async getLastSeen(uid: number) {
        return await inTx(async () => {
            let res = await this.online.getById(uid);

            if (res) {
                if (res.value.lastSeen > Date.now()) {
                    return 'online';
                } else {
                    return res.value.lastSeen;
                }
            } else {
                return 'never_online';
            }
        });
    }
}