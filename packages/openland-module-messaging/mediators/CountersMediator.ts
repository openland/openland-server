import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { CountersRepository } from 'openland-module-messaging/repositories/CountersRepository';
import { Message } from 'openland-module-db/schema';
import { Context } from '@openland/context';
import { createTracer } from 'openland-log/createTracer';

const tracer = createTracer('messaging-counters');

@injectable()
export class CountersMediator {

    @lazyInject('CountersRepository')
    private readonly repo!: CountersRepository;

    onMessageReceived = async (parent: Context, uid: number, message: Message) => {
        return await tracer.trace(parent, 'onMessageReceived', async (ctx2) => await inTx(ctx2, async (ctx) => {
            return await this.repo.onMessageReceived(ctx, uid, message);
        }));
    }

    onMessageDeleted = async (parent: Context, uid: number, message: Message) => {
        return await tracer.trace(parent, 'onMessageDeleted', async (ctx2) => await inTx(ctx2, async (ctx) => {
            return await this.repo.onMessageDeleted(ctx, uid, message);
        }));
    }

    onMessageRead = async (parent: Context, uid: number, message: Message) => {
        return await tracer.trace(parent, 'onMessageRead', async (ctx2) => await inTx(ctx2, async (ctx) => {
            return await this.repo.onMessageRead(ctx, uid, message);
        }));
    }

    onDialogDeleted = async (parent: Context, uid: number, cid: number) => {
        return await inTx(parent, async (ctx) => {
            return await this.repo.onDialogDeleted(ctx, uid, cid);
        });
    }

    onDialogMuteChange = async (parent: Context, uid: number, cid: number) => {
        return await inTx(parent, async (ctx) => {
            return await this.repo.onDialogMuteChange(ctx, uid, cid);
        });
    }
}