import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { injectable, inject } from 'inversify';
import { UserStateRepository } from './UserStateRepository';

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

    async deliverMessageToUser(uid: number, mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(mid));
            if (!message) {
                throw Error('Message not found');
            }

            // Update dialog and deliver update
            let local = await this.userState.getUserDialogState(uid, message.cid);
            let global = await this.userState.getUserMessagingState(uid);
            local.date = message.createdAt;
            global.seq++;
            await this.entities.UserDialogEvent.create(uid, global.seq, {
                kind: 'message_received',
                cid: message.cid,
                mid: message.id,
                allUnread: global.unread,
                unread: local.unread
            });
        });
    }

    async deliverMessageUpdateToUser(uid: number, mid: number) {
        await inTx(async () => {
            let global = await this.userState.getUserMessagingState(uid);
            global.seq++;
            await this.entities.UserDialogEvent.create(uid, global.seq, {
                kind: 'message_updated',
                mid: mid
            });
        });
    }

    async deliverMessageDeleteToUser(uid: number, mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(mid));
            if (!message) {
                throw Error('Message not found');
            }

            // TODO: Update date
            let global = await this.userState.getUserMessagingState(uid);
            let local = await this.userState.getUserDialogState(uid, message.cid);
            global.seq++;
            await this.entities.UserDialogEvent.create(uid, global.seq, {
                kind: 'message_deleted',
                mid: message.id,
                allUnread: global.unread,
                unread: local.unread
            });
        });
    }

    async deliverDialogDeleteToUser(uid: number, cid: number) {
        return await inTx(async () => {
            let local = await this.userState.getUserDialogState(uid, cid);
            let global = await this.userState.getUserMessagingState(uid);
            global.seq++;
            local.date = null;
            await this.entities.UserDialogEvent.create(uid, global.seq, {
                kind: 'dialog_deleted',
                cid: cid,
                unread: 0,
                allUnread: global.unread
            });
        });
    }

    async deliverMessageReadToUser(uid: number, mid: number, delta: number) {
        await inTx(async () => {
            let msg = await this.entities.Message.findById(mid);
            if (!msg) {
                throw Error('Unable to find message');
            }

            // Deliver update if needed
            if (delta !== 0) {
                let global = await this.userState.getUserMessagingState(uid);
                let local = await this.userState.getUserDialogState(uid, msg.cid);
                global.seq++;
                await this.entities.UserDialogEvent.create(uid, global.seq, {
                    kind: 'message_read',
                    cid: msg.cid,
                    unread: local.unread,
                    allUnread: global.unread
                });
            }
        });
    }
}