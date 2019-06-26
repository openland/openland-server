import { Context } from '@openland/context';
import { inTx, inTxLeaky } from '@openland/foundationdb';
import { FDB } from '../openland-module-db/FDB';
import { uuid } from '../openland-utils/uuid';
import { JsonMap } from '../openland-utils/json';
import { singletonWorker } from '@openland/foundationdb-singleton';

export class DelayedQueue<ARGS, RES extends JsonMap> {
    constructor(
        private taskType: string
    ) {

    }

    pushWork = async (parent: Context, work: ARGS, fireAt: number) => {
        return await inTxLeaky(parent, async (ctx) => {
            // Do UNSAFE task creation since there won't be conflicts because our is is guaranteed to be unique (uuid)
            return await FDB.DelayedTask.create_UNSAFE(ctx, this.taskType, uuid(), {
                arguments: work,
                taskStatus: 'pending',
                delay: fireAt * -1
            });

        });
    }

    start = (handler: (item: ARGS, ctx: Context) => RES | Promise<RES>) => {
        singletonWorker({ db: FDB.layer.db, name: `delayed_queue_${this.taskType}`, delay: 3000, startDelay: 0 }, async (parent) => {
            await inTx(parent, async ctx => {
                let tasks = await FDB.DelayedTask.rangeFromPendingAfter(ctx, this.taskType, Date.now() * -1, 10);
                for (let task of tasks) {
                    let res = await handler(task.arguments, ctx);
                    task.taskStatus = 'completed';
                    task.result = res;
                }
            });
        });
    }
}