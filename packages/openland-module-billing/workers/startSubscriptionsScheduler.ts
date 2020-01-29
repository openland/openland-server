import { Store } from 'openland-module-db/FDB';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { SubscriptionsMediator } from './../mediators/SubscriptionsMediator';
import { inTx } from '@openland/foundationdb';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { createLogger } from '@openland/log';

//
//
// 
//   /$$$$$$$   /$$$$$$        /$$   /$$  /$$$$$$  /$$$$$$$$       /$$$$$$$$ /$$$$$$  /$$   /$$  /$$$$$$  /$$   /$$
//   | $$__  $$ /$$__  $$      | $$$ | $$ /$$__  $$|__  $$__/      |__  $$__//$$__  $$| $$  | $$ /$$__  $$| $$  | $$
//   | $$  \ $$| $$  \ $$      | $$$$| $$| $$  \ $$   | $$            | $$  | $$  \ $$| $$  | $$| $$  \__/| $$  | $$
//   | $$  | $$| $$  | $$      | $$ $$ $$| $$  | $$   | $$            | $$  | $$  | $$| $$  | $$| $$      | $$$$$$$$
//   | $$  | $$| $$  | $$      | $$  $$$$| $$  | $$   | $$            | $$  | $$  | $$| $$  | $$| $$      | $$__  $$
//   | $$  | $$| $$  | $$      | $$\  $$$| $$  | $$   | $$            | $$  | $$  | $$| $$  | $$| $$    $$| $$  | $$
//   | $$$$$$$/|  $$$$$$/      | $$ \  $$|  $$$$$$/   | $$            | $$  |  $$$$$$/|  $$$$$$/|  $$$$$$/| $$  | $$
//  |_______/  \______/       |__/  \__/ \______/    |__/            |__/   \______/  \______/  \______/ |__/  |__/
//
//
//

export function startSubscriptionsScheduler(mediator: SubscriptionsMediator) {

    const log = createLogger('subscriptions-scheduler');

    let queue = new WorkQueue<{ pid: string, uid: number }, { result: string }>('subscription-cancel-task', -1);
    queue.addWorker(async (item, ctx) => {
        await mediator.payments.tryCancelPaymentIntent(ctx, item.uid, item.pid);
        return { result: 'ok' };
    });

    singletonWorker({ db: Store.storage.db, name: 'subscription-scheduler', delay: 1000 }, async (parent) => {
        let subscriptions = await inTx(parent, async (ctx) => await Store.WalletSubscription.active.findAll(ctx));
        for (let s of subscriptions) {
            let now = Date.now();
            await inTx(parent, async (ctx) => {
                let plan = await mediator.subscriptions.planScheduling(ctx, s.id, now);
                if (plan === 'schedule') {
                    log.debug(ctx, '[' + s.id + ']: Schedule');
                    await mediator.subscriptions.scheduleNextPeriod(ctx, s.id);
                } else if (plan === 'start_grace_period') {
                    log.debug(ctx, '[' + s.id + ']: Start Grace Period');
                    await mediator.subscriptions.enterGracePeriod(ctx, s.uid, s.id);
                } else if (plan === 'start_retry') {
                    log.debug(ctx, '[' + s.id + ']: Start Retry Period');
                    await mediator.subscriptions.enterRetryingPeriod(ctx, s.uid, s.id);
                } else if (plan === 'expire') {
                    log.debug(ctx, '[' + s.id + ']: Expired');
                    await mediator.subscriptions.enterExpiredState(ctx, s.uid, s.id);
                } else if (plan === 'try_cancel') {
                    log.debug(ctx, '[' + s.id + ']: Cancel');
                    await mediator.subscriptions.enterCanceledState(ctx, s.uid, s.id);

                    // Schedule payment cancel
                    let scheduling = await Store.WalletSubscriptionScheduling.findById(ctx, s.id);
                    if (scheduling) {
                        let pid = (await Store.WalletSubscriptionPeriod.findById(ctx, s.id, scheduling.currentPeriodIndex))!;
                        if (pid.pid) {
                            await queue.pushWork(ctx, { pid: pid.pid, uid: s.uid });
                        }
                    }
                } else if (plan === 'nothing') {
                    // Nothing to do
                } else {
                    throw Error('Unknown plan result: ' + plan);
                }
            });
        }
    });
}