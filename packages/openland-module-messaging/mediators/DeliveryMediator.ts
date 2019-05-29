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
import { ImageRef } from 'openland-module-media/ImageRef';
import { trackEvent } from '../../openland-module-hyperlog/Log.resolver';
import { uuid } from '../../openland-utils/uuid';
// import { PushNotificationMediator } from './PushNotificationMediator';

const tracer = createTracer('message-delivery');
const isProd = process.env.APP_ENVIRONMENT === 'production';

@injectable()
export class DeliveryMediator {
    private readonly queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_delivery');
    private readonly queueUser = new WorkQueue<{ messageId: number, uid: number }, { result: string }>('conversation_message_delivery_user');

    @lazyInject('FDB') private readonly entities!: AllEntities;
    @lazyInject('DeliveryRepository') private readonly repo!: DeliveryRepository;
    @lazyInject('CountersMediator') private readonly counters!: CountersMediator;
    @lazyInject('RoomMediator') private readonly room!: RoomMediator;
    // @lazyInject('PushNotificationMediator') private readonly pushNotificationMediator!: PushNotificationMediator;

    start = () => {
        if (serverRoleEnabled('delivery')) {
            this.queue.addWorker(async (item, parent) => {
                await this.deliverNewMessage(parent, item.messageId);
                return { result: 'ok' };
            });
            this.queueUser.addWorker(async (item, parent) => {
                await this.deliverMessageToUser(parent, item.uid, item.messageId);
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

    onDialogTitleUpdate = async (ctx: Context, uid: number, cid: number, title: string) => {
        await this.repo.deliverDialogTitleUpadtedToUser(ctx, uid, cid, title);
    }

    onDialogPhotoUpdate = async (ctx: Context, uid: number, cid: number, photo?: ImageRef) => {
        await this.repo.deliverDialogPhotoUpadtedToUser(ctx, uid, cid, photo);
    }

    onDialogBump = async (ctx: Context, uid: number, cid: number, date: number) => {
        await this.repo.deliverDialogBumpToUser(ctx, uid, cid, date);
    }

    onUserProfileUpdated = async (ctx: Context, uid: number) => {
        //
    }

    onDialogMuteChanged = async (ctx: Context, uid: number, cid: number, mute: boolean) => {
        // await this.counters.onDialogMuteChange(ctx, uid, cid, mute);
        await this.repo.deliverDialogMuteChangedToUser(ctx, uid, cid, mute);
        // await this.repo.deliverCurrentCountersToUser(ctx, uid, cid);
    }

    onOrganizationProfileUpdated = async (ctx: Context, oid: number) => {
        // await inTx(async () => {
        //     let org = await this.room.resolveOrganizationChat(oid);
        //     // let title =
        // });
    }

    private async deliverNewMessage(parent: Context, mid: number) {
        await tracer.trace(parent, 'deliverNewMessage', async (tctx) => {
            await inTx(tctx, async (ctx) => {
                let message = (await this.entities.Message.findById(ctx, mid))!;
                let members = await this.room.findConversationMembers(ctx, message.cid);

                // Deliver messages
                if (members.length > 0) {
                    await Promise.all(members.map(async (m) => {
                        await this.queueUser.pushWork(ctx, { messageId: mid, uid: m });
                    }));
                }
                // Notifications
                // await this.pushNotificationMediator.onNewMessage(ctx, mid);
            });
        });
    }

    private async deliverUpdateMessage(parent: Context, mid: number) {
        await tracer.trace(parent, 'deliverUpdateMessage', async (tctx) => {
            await inTx(tctx, async (ctx) => {
                let message = (await this.entities.Message.findById(ctx, mid))!;
                let members = await this.room.findConversationMembers(ctx, message.cid);

                // Deliver messages
                if (members.length > 0) {
                    await Promise.all(members.map(async (m) => {
                        await this.deliverMessageUpdateToUser(ctx, m, mid);
                    }));
                }
            });
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
            let res = await this.counters.onMessageRead(ctx, uid, mid);
            await this.repo.deliverMessageReadToUser(ctx, uid, mid, res.delta);
            if (res.mentionReset) {
                let message = (await this.entities.Message.findById(ctx, mid));
                await this.repo.deliverDialogMentionedChangedToUser(ctx, uid, message!.cid, false);
            }
        });
    }

    private deliverMessageToUser = async (parent: Context, uid: number, mid: number) => {
        await tracer.trace(parent, 'deliverMessageToUser', async (tctx) => {
            await inTx(tctx, async (ctx) => {
                let res = await this.counters.onMessageReceived(ctx, uid, mid);
                await this.repo.deliverMessageToUser(ctx, uid, mid);
                await trackEvent.event(ctx, { id: uuid(), platform: 'WEB', uid, name: 'message_recieved', did: 'server', args: undefined, isProd, time: Date.now() });

                if (res.setMention) {
                    let message = (await this.entities.Message.findById(ctx, mid));
                    await this.repo.deliverDialogMentionedChangedToUser(ctx, uid, message!.cid, true);
                }
            });
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