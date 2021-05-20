import { CallRepository } from './../repositories/CallRepository';
import { Context } from '@openland/context';

export function declareScalableWorker(repo: CallRepository) {
    repo.schedulerScalable.producersWorker.addWorker(10, async (ctx: Context, items) => {
        await repo.schedulerScalable.mediator.onProducerJob(ctx, items[0].cid, items);
    });
}