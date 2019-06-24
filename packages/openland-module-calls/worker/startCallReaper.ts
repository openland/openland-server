import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { FDB } from 'openland-module-db/FDB';

export function startCallReaper() {
    singletonWorker({ db: FDB.layer.db, name: 'call-reaper', delay: 1000 }, async (parent) => {
        await inTx(parent, async (ctx) => {
            await Modules.Calls.repo.checkTimeouts(ctx);
        });
    });
}