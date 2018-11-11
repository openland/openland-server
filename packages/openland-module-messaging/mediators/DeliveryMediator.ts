import { injectable } from 'inversify';
import { createTracer } from 'openland-log/createTracer';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { withTracing } from 'openland-log/withTracing';
import { DeliveryRepository } from 'openland-module-messaging/repositories/DeliveryRepository';
import { Message, AllEntities } from 'openland-module-db/schema';
import { lazyInject } from 'openland-modules/Modules.container';
import { CountersMediator } from './CountersMediator';
import { inTx } from 'foundation-orm/inTx';
import { RoomRepository } from 'openland-module-messaging/repositories/RoomRepository';

const tracer = createTracer('message-delivery');

@injectable()
export class DeliveryMediator {
    private readonly queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_delivery');

    @lazyInject('FDB') private readonly entities!: AllEntities;
    @lazyInject('DeliveryRepository') private readonly repo!: DeliveryRepository;
    @lazyInject('CountersMediator') private readonly counters!: CountersMediator;
    @lazyInject('RoomRepository') private readonly room!: RoomRepository;

    start = () => {
        if (serverRoleEnabled('delivery')) {
            this.queue.addWorker(async (item) => {
                await withTracing(tracer, 'delivery', async () => {
                    await this.deliverNewMessage(item.messageId);
                });
                return { result: 'ok' };
            });
        }
    }

    onNewMessage = async (message: Message) => {
        await this.queue.pushWork({ messageId: message.id });
    }

    onUpdateMessage = async (message: Message) => {
        await this.deliverUpdateMessage(message.id);
    }

    onDeleteMessage = async (message: Message) => {
        await this.deliverDeleteMessage(message.id);
    }

    onRoomRead = async (uid: number, mid: number) => {
        await this.deliverMessageReadToUser(uid, mid);
    }

    onDialogDelete = async (uid: number, cid: number) => {
        await this.deliverDialogDeleteToUser(uid, cid);
    }

    private async deliverNewMessage(mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(mid))!;
            let members = await this.room.findConversationMembers(message.cid);

            // Deliver messages
            if (members.length > 0) {
                await Promise.all(members.map(async (m) => {
                    await this.deliverMessageToUser(m, mid);
                }));
            }
        });
    }

    private async deliverUpdateMessage(mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(mid))!;
            let members = await this.room.findConversationMembers(message.cid);

            // Deliver messages
            if (members.length > 0) {
                await Promise.all(members.map(async (m) => {
                    await this.deliverMessageUpdateToUser(m, mid);
                }));
            }
        });
    }

    private async deliverDeleteMessage(mid: number) {
        await inTx(async () => {
            let message = (await this.entities.Message.findById(mid))!;
            let members = await this.room.findConversationMembers(message.cid);

            // Deliver messages
            if (members.length > 0) {
                await Promise.all(members.map(async (m) => {
                    await this.deliverMessageDeleteToUser(m, mid);
                }));
            }
        });
    }

    private async deliverMessageReadToUser(uid: number, mid: number) {
        await inTx(async () => {
            let delta = await this.counters.onMessageRead(uid, mid);
            await this.repo.deliverMessageReadToUser(uid, mid, delta);
        });
    }

    private deliverMessageToUser = async (uid: number, mid: number) => {
        await inTx(async () => {
            await this.counters.onMessageReceived(uid, mid);
            await this.repo.deliverMessageToUser(uid, mid);
        });
    }

    private deliverMessageUpdateToUser = async (uid: number, mid: number) => {
        await this.repo.deliverMessageUpdateToUser(uid, mid);
    }

    private deliverMessageDeleteToUser = async (uid: number, mid: number) => {
        await inTx(async () => {
            await this.counters.onMessageDeleted(uid, mid);
            await this.repo.deliverMessageDeleteToUser(uid, mid);
        });
    }

    private deliverDialogDeleteToUser = async (uid: number, cid: number) => {
        await inTx(async () => {
            let delta = await this.counters.onDialogDeleted(uid, cid);
            await this.repo.deliverDialogDeleteToUser(uid, cid, delta);
        });
    }
}