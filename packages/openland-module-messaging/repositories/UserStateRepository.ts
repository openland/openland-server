import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { injectable, inject } from 'inversify';

@injectable()
export class UserStateRepository {
    private readonly entities: AllEntities;

    constructor(@inject('FDB') entities: AllEntities) {
        this.entities = entities;
    }

    async getRoomSettings(uid: number, cid: number) {
        return await inTx(async () => {
            let res = await this.entities.UserDialogSettings.findById(uid, cid);
            if (res) {
                return res;
            }
            return await this.entities.UserDialogSettings.create(uid, cid, { mute: false });
        });
    }

    async markAsSeqRead(uid: number, toSeq: number) {
        await inTx(async () => {
            await inTx(async () => {
                let state = await this.getUserNotificationState(uid);
                let global = await this.getUserMessagingState(uid);
                if (toSeq > global.seq) {
                    state.readSeq = global.seq;
                } else {
                    state.readSeq = toSeq;
                }
                await state.flush();
            });
        });
    }

    async getUserNotificationState(uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserNotificationsState.findById(uid);
            if (!existing) {
                let created = await this.entities.UserNotificationsState.create(uid, {});
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }

    async getUserMessagingState(uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserMessagingState.findById(uid);
            if (!existing) {
                let created = await this.entities.UserMessagingState.create(uid, { seq: 0, unread: 0 });
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }

    async getUserDialogState(uid: number, cid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserDialog.findById(uid, cid);
            if (!existing) {
                let created = await this.entities.UserDialog.create(uid, cid, { unread: 0 });
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }
}