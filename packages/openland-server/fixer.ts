import { Context } from '@openland/context';
import { singletonWorker } from '@openland/foundationdb-singleton';
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

export function startFixer() {
    if (serverRoleEnabled('workers')) {
        singletonWorker({ db: Store.storage.db, name: 'fixer', delay: 15000 }, async (parent) => {

            // Fix wallet locks
            await fixWalletLock(parent);
        });
    }
}