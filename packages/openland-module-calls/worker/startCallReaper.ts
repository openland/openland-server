import { inTx } from '@openland/foundationdb';
import { staticWorker } from 'openland-module-workers/staticWorker';
import { Modules } from 'openland-modules/Modules';

export function startCallReaper() {
    staticWorker({ name: 'call-reaper', delay: 1000 }, async (parent) => {
        return await inTx(parent, async (ctx) => {
            await Modules.Calls.repo.checkTimeouts(ctx);
            return false;
        });
    });
}