import { CallRepository } from '../repositories/CallRepository';
import { Context } from '@openland/context';

export function declareScalableWorkers(repo: CallRepository) {
    repo.schedulerScalable.sessionWorker.addWorker(10, async (ctx: Context, items) => {
        await repo.schedulerScalable.mediator.onSessionJob(ctx, items[0].cid, items);
    });
    repo.schedulerScalable.shardWorker.addWorker(10, async (ctx: Context, items) => {
        await repo.schedulerScalable.mediator.onShardJob(ctx, items[0].cid, items[0].session, items[0].shard, items);
    });
}