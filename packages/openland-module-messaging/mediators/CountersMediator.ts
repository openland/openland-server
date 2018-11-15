import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { CountersRepository } from 'openland-module-messaging/repositories/CountersRepository';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { AllEntities } from 'openland-module-db/schema';
import { UserStateRepository } from 'openland-module-messaging/repositories/UserStateRepository';
import { Context } from 'openland-utils/Context';

@injectable()
export class CountersMediator {

    @lazyInject('CountersRepository')
    private readonly repo!: CountersRepository;
    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('UserStateRepository')
    private readonly userState!: UserStateRepository;

    onMessageReceived = async (ctx: Context, uid: number, mid: number) => {
        return await inTx(async () => {
            let res = await this.repo.onMessageReceived(ctx, uid, mid);
            if (res !== 0) {
                let message = (await this.entities.Message.findById(ctx, mid));
                if (!message) {
                    throw Error('Unable to find message');
                }
                await this.deliverCounterPush(ctx, uid, message.cid);
            }
            return res;
        });
    }

    onMessageDeleted = async (ctx: Context, uid: number, mid: number) => {
        return await inTx(async () => {
            let res = await this.repo.onMessageDeleted(ctx, uid, mid);
            if (res !== 0) {
                let message = (await this.entities.Message.findById(ctx, mid));
                if (!message) {
                    throw Error('Unable to find message');
                }
                await this.deliverCounterPush(ctx, uid, message.cid);
            }
            return res;
        });
    }

    onMessageRead = async (ctx: Context, uid: number, mid: number) => {
        return await inTx(async () => {
            let res = await this.repo.onMessageRead(ctx, uid, mid);
            if (res !== 0) {
                let message = (await this.entities.Message.findById(ctx, mid));
                if (!message) {
                    throw Error('Unable to find message');
                }
                await this.deliverCounterPush(ctx, uid, message.cid);
            }
            return res;
        });
    }

    onDialogDeleted = async (ctx: Context, uid: number, cid: number) => {
        return await inTx(async () => {
            let res = await this.repo.onDialogDeleted(ctx, uid, cid);
            if (res !== 0) {
                await this.deliverCounterPush(ctx, uid, cid);
            }
            return res;
        });
    }

    private deliverCounterPush = async (ctx: Context, uid: number, cid: number) => {
        let global = await this.userState.getUserMessagingState(ctx, uid);
        await Modules.Push.sendCounterPush(ctx, uid, cid, global.unread);
    }
}