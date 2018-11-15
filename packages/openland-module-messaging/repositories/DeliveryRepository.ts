import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { injectable, inject } from 'inversify';
import { UserStateRepository } from './UserStateRepository';
import { Context } from 'openland-utils/Context';

@injectable()
export class DeliveryRepository {
    private readonly entities: AllEntities;
    private readonly userState: UserStateRepository;

    constructor(
        @inject('FDB') entities: AllEntities,
        @inject('UserStateRepository') userState: UserStateRepository
    ) {
        this.entities = entities;
        this.userState = userState;
    }

    async deliverMessageToUser(ctx: Context, uid: number, mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(ctx, mid));
            if (!message) {
                throw Error('Message not found');
            }

            // Update dialog and deliver update
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            let global = await this.userState.getUserMessagingState(ctx, uid);
            local.date = message.createdAt;
            global.seq++;
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'message_received',
                cid: message.cid,
                mid: message.id,
                allUnread: global.unread,
                unread: local.unread
            });
        });
    }

    async deliverMessageUpdateToUser(ctx: Context, uid: number, mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(ctx, mid));
            if (!message) {
                throw Error('Message not found');
            }
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'message_updated',
                cid: message.cid,
                mid: mid
            });
        });
    }

    async deliverMessageDeleteToUser(ctx: Context, uid: number, mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(ctx, mid));
            if (!message) {
                throw Error('Message not found');
            }

            // TODO: Update date
            let global = await this.userState.getUserMessagingState(ctx, uid);
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            global.seq++;
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'message_deleted',
                cid: message.cid,
                mid: message.id,
                allUnread: global.unread,
                unread: local.unread
            });
        });
    }

    async deliverDialogDeleteToUser(ctx: Context, uid: number, cid: number) {
        return await inTx(async () => {
            let local = await this.userState.getUserDialogState(ctx, uid, cid);
            let global = await this.userState.getUserMessagingState(ctx, uid);
            global.seq++;
            local.date = null;
            await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                kind: 'dialog_deleted',
                cid: cid,
                unread: 0,
                allUnread: global.unread
            });
        });
    }

    async deliverMessageReadToUser(ctx: Context, uid: number, mid: number, delta: number) {
        await inTx(async () => {
            let msg = await this.entities.Message.findById(ctx, mid);
            if (!msg) {
                throw Error('Unable to find message');
            }

            // Deliver update if needed
            if (delta !== 0) {
                let global = await this.userState.getUserMessagingState(ctx, uid);
                let local = await this.userState.getUserDialogState(ctx, uid, msg.cid);
                global.seq++;
                await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                    kind: 'message_read',
                    cid: msg.cid,
                    unread: local.unread,
                    allUnread: global.unread
                });
            }
        });
    }
}