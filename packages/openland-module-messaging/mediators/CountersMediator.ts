import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { CountersRepository } from 'openland-module-messaging/repositories/CountersRepository';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { AllEntities, Message } from 'openland-module-db/schema';
import { UserStateRepository } from 'openland-module-messaging/repositories/UserStateRepository';
import { Context } from 'openland-utils/Context';
import { createTracer } from 'openland-log/createTracer';

const tracer = createTracer('messaging-counters');

@injectable()
export class CountersMediator {

    @lazyInject('CountersRepository')
    private readonly repo!: CountersRepository;
    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('UserStateRepository')
    private readonly userState!: UserStateRepository;

    onMessageReceived = async (parent: Context, uid: number, message: Message) => {
        return await tracer.trace(parent, 'onMessageReceived', async (ctx2) => await inTx(ctx2, async (ctx) => {
            let res = await this.repo.onMessageReceived(ctx, uid, message);
            if (res.delta !== 0) {
                await this.deliverCounterPush(ctx, uid, message.cid);
            }
            return res;
        }));
    }

    onMessageDeleted = async (parent: Context, uid: number, mid: number) => {
        return await tracer.trace(parent, 'onMessageDeleted', async (ctx2) => await inTx(ctx2, async (ctx) => {
            let res = await this.repo.onMessageDeleted(ctx, uid, mid);
            if (res !== 0) {
                let message = (await this.entities.Message.findById(ctx, mid));
                if (!message) {
                    throw Error('Unable to find message');
                }
                await this.deliverCounterPush(ctx, uid, message.cid);
            }
            return res;
        }));
    }

    onMessageRead = async (parent: Context, uid: number, mid: number) => {
        return await tracer.trace(parent, 'onMessageRead', async (ctx2) => await inTx(ctx2, async (ctx) => {
            let res = await this.repo.onMessageRead(ctx, uid, mid);
            if (res.delta !== 0) {
                let message = (await this.entities.Message.findById(ctx, mid));
                if (!message) {
                    throw Error('Unable to find message');
                }
                await this.deliverCounterPush(ctx, uid, message.cid);
            }
            return res;
        }));
    }

    onDialogDeleted = async (parent: Context, uid: number, cid: number) => {
        return await inTx(parent, async (ctx) => {
            let res = await this.repo.onDialogDeleted(ctx, uid, cid);
            if (res !== 0) {
                await this.deliverCounterPush(ctx, uid, cid);
            }
            return res;
        });
    }

    onDialogMuteChange = async (parent: Context, uid: number, cid: number, mute: boolean) => {
        return await inTx(parent, async (ctx) => {
            let res = await this.repo.onDialogMuteChange(ctx, uid, cid, mute);
            if (res !== 0) {
                await this.deliverCounterPush(ctx, uid, cid);
            }
            return res;
        });
    }

    private deliverCounterPush = async (ctx: Context, uid: number, cid: number) => {
        let globalCounter = await this.userState.getUserMessagingUnread(ctx, uid);
        await Modules.Push.sendCounterPush(ctx, uid, cid, globalCounter);
    }
}