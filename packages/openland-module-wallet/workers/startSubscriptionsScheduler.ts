import { Store } from 'openland-module-db/FDB';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { inTx } from '@openland/foundationdb';
import { SubscriptionsRepository } from 'openland-module-wallet/repo/SubscriptionsRepository';
import { PaymentMediator } from 'openland-module-wallet/mediators/PaymentMediator';
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

    let queue = new WorkQueue<{ pid: string }>('subscription-cancel-task', -1);
    queue.addWorker(async (item, ctx) => {
        await payments.tryCancelPayment(ctx, item.pid);
    });

    singletonWorker({ db: Store.storage.db, name: 'subscription-scheduler', delay: 1000 }, async (parent) => {
        let subscriptions = await inTx(parent, async (ctx) => await Store.WalletSubscription.active.findAll(ctx));
        for (let s of subscriptions) {
            let now = Date.now();
            await repository.doScheduling(parent, s.id, now);
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