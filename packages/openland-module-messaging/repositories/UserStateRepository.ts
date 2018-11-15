import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { injectable, inject } from 'inversify';
import { Context } from 'openland-utils/Context';

@injectable()
export class UserStateRepository {
    private readonly entities: AllEntities;

    constructor(@inject('FDB') entities: AllEntities) {
        this.entities = entities;
    }

    async getRoomSettings(ctx: Context, uid: number, cid: number) {
        return await inTx(async () => {
            let res = await this.entities.UserDialogSettings.findById(ctx, uid, cid);
            if (res) {
                return res;
            }
            return await this.entities.UserDialogSettings.create(ctx, uid, cid, { mute: false });
        });
    }

    async markAsSeqRead(ctx: Context, uid: number, toSeq: number) {
        await inTx(async () => {
            let state = await this.getUserNotificationState(ctx, uid);
            let global = await this.getUserMessagingState(ctx, uid);
            if (toSeq > global.seq) {
                state.readSeq = global.seq;
            } else {
                state.readSeq = toSeq;
            }
            await state.flush();
        });
    }

    async getUserNotificationState(ctx: Context, uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserNotificationsState.findById(ctx, uid);
            if (!existing) {
                let created = await this.entities.UserNotificationsState.create(ctx, uid, {});
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }

    async getUserMessagingState(ctx: Context, uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserMessagingState.findById(ctx, uid);
            if (!existing) {
                let created = await this.entities.UserMessagingState.create(ctx, uid, { seq: 0, unread: 0 });
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }

    async getUserDialogState(ctx: Context, uid: number, cid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserDialog.findById(ctx, uid, cid);
            if (!existing) {
                let created = await this.entities.UserDialog.create(ctx, uid, cid, { unread: 0 });
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }
}