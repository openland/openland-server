import { Context } from '@openland/context';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { createLogger } from '@openland/log';
import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

const logger = createLogger('fixer');

async function fixWalletLock(parent: Context) {
    logger.log(parent, 'Fixing Wallet Locks');
    await Store.Wallet.iterateAllItems(parent, 100, async (ctx, items) => {
        for (let item of items) {
            logger.log(parent, 'Fixing Wallet lock for ' + item.uid);
            await Modules.Wallet.updateIsLocked(ctx, item.uid);
        }
    });
}

async function cleanupSubscriptions(parent: Context) {
    const groupsToUnsubscribe = new Set<string>();
    groupsToUnsubscribe.add('k4awPklKRQcOKgMEBoJOIn9okk');

    // Collect to cancel
    let toCancel = new Set<string>();
    logger.log(parent, 'Fixing subscriptions');
    await Store.Wallet.iterateAllItems(parent, 10, async (ctx, items) => {
        for (let item of items) {
            logger.log(parent, 'Fixing subscriptions for ' + item.uid);
            let subscriptions = await Store.WalletSubscription.user.findAll(ctx, item.uid);
            for (let sub of subscriptions) {
                if (sub.state === 'expired') {
                    continue;
                }
                if (sub.state === 'canceled') {
                    continue;
                }
                if (sub.proudct.type === 'group') {
                    let id = IDs.Conversation.serialize(sub.proudct.gid);
                    if (groupsToUnsubscribe.has(id)) {
                        toCancel.add(sub.id);
                    }
                }
            }
        }
    });

    // Pending cancel
    for (let s of toCancel) {
        logger.log(parent, 'Canceling subscription ' + s);
        await Modules.Wallet.cancelSubscription(parent, s);
    }
}

export function startFixer() {
    if (serverRoleEnabled('workers')) {
        singletonWorker({ db: Store.storage.db, name: 'fixer', delay: 15000 }, async (parent) => {

            logger.log(parent, 'Start Fixer');

            // Fix wallet locks
            await fixWalletLock(parent);

            // Remove subscriptions
            await cleanupSubscriptions(parent);

            logger.log(parent, 'End Fixer');
        });
    }
}