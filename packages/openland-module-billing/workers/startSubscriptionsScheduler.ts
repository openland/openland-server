import { Store } from 'openland-module-db/FDB';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { inTx } from '@openland/foundationdb';
import { createLogger } from '@openland/log';
import { SubscriptionsRepository } from 'openland-module-billing/repo/SubscriptionsRepository';
import { PaymentMediator } from 'openland-module-billing/mediators/PaymentMediator';
import { WorkQueue } from 'openland-module-workers/WorkQueue';

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

export function startSubscriptionsScheduler(repository: SubscriptionsRepository, payments: PaymentMediator) {

    const log = createLogger('subscriptions-scheduler');

    let queue = new WorkQueue<{ pid: string }, { result: string }>('subscription-cancel-task', -1);
    queue.addWorker(async (item, ctx) => {
        await payments.tryCancelPayment(ctx, item.pid);
        return { result: 'ok' };
    });

    singletonWorker({ db: Store.storage.db, name: 'subscription-scheduler', delay: 1000 }, async (parent) => {
        let subscriptions = await inTx(parent, async (ctx) => await Store.WalletSubscription.active.findAll(ctx));
        for (let s of subscriptions) {
            let now = Date.now();
            await inTx(parent, async (ctx) => {
                let plan = await repository.planScheduling(ctx, s.id, now);
                if (plan === 'schedule') {
                    log.debug(ctx, '[' + s.id + ']: Schedule');
                    await repository.scheduleNextPeriod(ctx, s.id);
                } else if (plan === 'start_grace_period') {
                    log.debug(ctx, '[' + s.id + ']: Start Grace Period');
                    await repository.enterGracePeriod(ctx, s.uid, s.id);
                } else if (plan === 'start_retry') {
                    log.debug(ctx, '[' + s.id + ']: Start Retry Period');
                    await repository.enterRetryingPeriod(ctx, s.uid, s.id);
                } else if (plan === 'expire') {
                    log.debug(ctx, '[' + s.id + ']: Expired');
                    await repository.enterExpiredState(ctx, s.uid, s.id);
                } else if (plan === 'try_cancel') {
                    log.debug(ctx, '[' + s.id + ']: Cancel');
                    await repository.enterCanceledState(ctx, s.uid, s.id);
                } else if (plan === 'nothing') {
                    // Nothing to do
                } else {
                    throw Error('Unknown plan result: ' + plan);
                }
            });
        }
    });

    singletonWorker({ db: Store.storage.db, name: 'subscription-canceler', delay: 10000 }, async (parent) => {
        let pending = await inTx(parent, async (ctx) => await Store.WalletSubscriptionPeriod.pendingCancel.findAll(ctx));
        for (let p of pending) {
            await inTx(parent, async (ctx) => {
                let period = (await Store.WalletSubscriptionPeriod.findById(ctx, p.id, p.index))!;
                if (period.needCancel && !period.scheduledCancel) {
                    period.scheduledCancel = true;
                    if (period.pid) {
                        await queue.pushWork(ctx, { pid: period.pid });
                    }
                }
            });
        }
    });
}