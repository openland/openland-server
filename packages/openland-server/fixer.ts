import { Context } from '@openland/context';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

async function fixWalletLock(parent: Context) {
    await Store.Wallet.iterateAllItems(parent, 100, async (ctx, items) => {
        for (let item of items) {
            await Modules.Wallet.updateIsLocked(ctx, item.uid);
        }
    });
}

async function cleanupSubscriptions(parent: Context) {
    const groupsToUnsubscribe = new Set<string>();
    groupsToUnsubscribe.add('k4awPklKRQcOKgMEBoJOIn9okk');

    // Collect to cancel
    let toCancel = new Set<string>();
    await Store.Wallet.iterateAllItems(parent, 10, async (ctx, items) => {
        for (let item of items) {
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
        await Modules.Wallet.cancelSubscription(parent, s);
    }
}

export function startFixer() {
    if (serverRoleEnabled('workers')) {
        singletonWorker({ db: Store.storage.db, name: 'fixer', delay: 15000 }, async (parent) => {

            // Fix wallet locks
            await fixWalletLock(parent);

            // Remove subscriptions
            await cleanupSubscriptions(parent);
        });
    }
}