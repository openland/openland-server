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
import { batch } from 'openland-utils/batch';
// import { PushNotificationMediator } from './PushNotificationMediator';

const tracer = createTracer('message-delivery');
const isProd = process.env.APP_ENVIRONMENT === 'production';

@injectable()
export class DeliveryMediator {
    private readonly queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_delivery');
    private readonly queueUser = new WorkQueue<{ messageId: number, uid: number }, { result: string }>('conversation_message_delivery_user');
    private readonly queueUserMultiple = new WorkQueue<{ messageId: number, uids: number[] }, { result: string }>('conversation_message_delivery_user_multiple');

    @lazyInject('FDB') private readonly entities!: AllEntities;
    @lazyInject('DeliveryRepository') private readonly repo!: DeliveryRepository;
    @lazyInject('CountersMediator') private readonly counters!: CountersMediator;
    @lazyInject('RoomMediator') private readonly room!: RoomMediator;
    // @lazyInject('PushNotificationMediator') private readonly pushNotificationMediator!: PushNotificationMediator;

    start = () => {
        if (serverRoleEnabled('delivery')) {
            for (let i = 0; i < 10; i++) {
                this.queue.addWorker(async (item, parent) => {
                    await this.deliverNewMessage(parent, item.messageId);
                    return { result: 'ok' };
                });
            }
            for (let i = 0; i < 10; i++) {
                this.queueUser.addWorker(async (item, parent) => {
                    await inTx(parent, async (ctx) => {
                        let message = (await this.entities.Message.findById(ctx, item.messageId))!;
                        await this.deliverMessageToUser(parent, item.uid, message);
                    });
                    return { result: 'ok' };
                });
            }
            for (let i = 0; i < 10; i++) {
                this.queueUserMultiple.addWorker(async (item, parent) => {
                    await tracer.trace(parent, 'deliver-multiple', async (ctx2) => {
                        await inTx(ctx2, async (ctx) => {
                            let message = (await this.entities.Message.findById(ctx, item.messageId))!;
                            for (let uid of item.uids) {
                                await this.deliverMessageToUser(ctx, uid, message);
                            }
                        });
                    });
                    return { result: 'ok' };
                });
            }
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
                    let batches = batch(members, 10);
                    for (let b of batches) {
                        await this.queueUserMultiple.pushWork(ctx, { messageId: mid, uids: b });
                    }
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

    private deliverMessageToUser = async (parent: Context, uid: number, message: Message) => {
        await tracer.trace(parent, 'deliverMessageToUser', async (tctx) => {
            await inTx(tctx, async (ctx) => {
                await this.repo.deliverMessageToUser(ctx, uid, message);

                let res = await this.counters.onMessageReceived(ctx, uid, message);
                if (res.setMention) {
                    await this.repo.deliverDialogMentionedChangedToUser(ctx, uid, message.cid, true);
                }

                await trackEvent.event(ctx, { id: uuid(), platform: 'WEB', uid, name: 'message_recieved', did: 'server', args: undefined, isProd, time: Date.now() });
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