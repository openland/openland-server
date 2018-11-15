import { injectable } from 'inversify';
import { createTracer } from 'openland-log/createTracer';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { DeliveryRepository } from 'openland-module-messaging/repositories/DeliveryRepository';
import { Message, AllEntities } from 'openland-module-db/schema';
import { lazyInject } from 'openland-modules/Modules.container';
import { CountersMediator } from './CountersMediator';
import { inTx } from 'foundation-orm/inTx';
import { RoomMediator } from './RoomMediator';
import { Context } from 'openland-utils/Context';

const tracer = createTracer('message-delivery');

@injectable()
export class DeliveryMediator {
    private readonly queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_delivery');

    @lazyInject('FDB') private readonly entities!: AllEntities;
    @lazyInject('DeliveryRepository') private readonly repo!: DeliveryRepository;
    @lazyInject('CountersMediator') private readonly counters!: CountersMediator;
    @lazyInject('RoomMediator') private readonly room!: RoomMediator;

    start = () => {
        if (serverRoleEnabled('delivery')) {
            this.queue.addWorker(async (item, parent) => {
                await tracer.trace(parent, 'delivery', async (ctx) => {
                    await this.deliverNewMessage(ctx, item.messageId);
                });
                return { result: 'ok' };
            });
        }
    }

    onNewMessage = async (ctx: Context, message: Message) => {
        await this.queue.pushWork(ctx, { messageId: message.id });
    }

    onUpdateMessage = async (ctx: Context, message: Message) => {
        await this.deliverUpdateMessage(ctx, message.id);
    }

    onDeleteMessage = async (ctx: Context, message: Message) => {
        await this.deliverDeleteMessage(ctx, message.id);
    }

    onRoomRead = async (ctx: Context, uid: number, mid: number) => {
        await this.deliverMessageReadToUser(ctx, uid, mid);
    }

    onDialogDelete = async (ctx: Context, uid: number, cid: number) => {
        await this.deliverDialogDeleteToUser(ctx, uid, cid);
    }

    onUserProfileUpdated = async (ctx: Context, uid: number) => {
        //
    }

    onOrganizationProfileUpdated = async (ctx: Context, oid: number) => {
        // await inTx(async () => {
        //     let org = await this.room.resolveOrganizationChat(oid);
        //     // let title =
        // });
    }

    private async deliverNewMessage(parent: Context, mid: number) {
        await inTx(parent, async (ctx) => {
            let message = (await this.entities.Message.findById(ctx, mid))!;
            let members = await this.room.findConversationMembers(ctx, message.cid);

            // Deliver messages
            if (members.length > 0) {
                await Promise.all(members.map(async (m) => {
                    await this.deliverMessageToUser(ctx, m, mid);
                }));
            }
        });
    }

    private async deliverUpdateMessage(parent: Context, mid: number) {
        await inTx(parent, async (ctx) => {
            let message = (await this.entities.Message.findById(ctx, mid))!;
            let members = await this.room.findConversationMembers(ctx, message.cid);

            // Deliver messages
            if (members.length > 0) {
                await Promise.all(members.map(async (m) => {
                    await this.deliverMessageUpdateToUser(ctx, m, mid);
                }));
            }
        });
    }

    private async deliverDeleteMessage(parent: Context, mid: number) {
        await inTx(parent, async (ctx) => {
            let message = (await this.entities.Message.findById(ctx, mid))!;
            let members = await this.room.findConversationMembers(ctx, message.cid);

            // Deliver messages
            if (members.length > 0) {
                await Promise.all(members.map(async (m) => {
                    await this.deliverMessageDeleteToUser(ctx, m, mid);
                }));
            }
        });
    }

    private async deliverMessageReadToUser(parent: Context, uid: number, mid: number) {
        await inTx(parent, async (ctx) => {
            let delta = await this.counters.onMessageRead(ctx, uid, mid);
            await this.repo.deliverMessageReadToUser(ctx, uid, mid, delta);
        });
    }

    private deliverMessageToUser = async (parent: Context, uid: number, mid: number) => {
        await inTx(parent, async (ctx) => {
            await this.counters.onMessageReceived(ctx, uid, mid);
            await this.repo.deliverMessageToUser(ctx, uid, mid);
        });
    }

    private deliverMessageUpdateToUser = async (ctx: Context, uid: number, mid: number) => {
        await this.repo.deliverMessageUpdateToUser(ctx, uid, mid);
    }

    private deliverMessageDeleteToUser = async (parent: Context, uid: number, mid: number) => {
        await inTx(parent, async (ctx) => {
            await this.counters.onMessageDeleted(ctx, uid, mid);
            await this.repo.deliverMessageDeleteToUser(ctx, uid, mid);
        });
    }

    private deliverDialogDeleteToUser = async (parent: Context, uid: number, cid: number) => {
        await inTx(parent, async (ctx) => {
            await this.counters.onDialogDeleted(ctx, uid, cid);
            await this.repo.deliverDialogDeleteToUser(ctx, uid, cid);
        });
    }
}