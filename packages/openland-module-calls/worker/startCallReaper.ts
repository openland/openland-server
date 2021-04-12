import { Store } from './../../openland-module-db/FDB';
import { inTx, withoutTransaction } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { singletonWorker } from '@openland/foundationdb-singleton';

export function startCallReaper() {
    singletonWorker({ db: Store.storage.db, name: 'call-reaper', delay: 1000 }, async (parent) => {
        await inTx(parent, async (ctx) => {
            await Modules.Calls.repo.checkTimeouts(withoutTransaction(ctx));
        });
    });
}