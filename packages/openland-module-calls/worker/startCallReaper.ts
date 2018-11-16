import { staticWorker } from 'openland-module-workers/staticWorker';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';
import { createLogger } from 'openland-log/createLogger';

let log = createLogger('call-reaper');
export function startCallReaper() {
    staticWorker({ name: 'call-reaper', delay: 1000 }, async (parent) => {
        return await inTx(parent, async (ctx) => {
            let active = await FDB.ConferenceRoomParticipant.allFromActive(ctx);
            let now = Date.now();
            for (let a of active) {
                if (a.keepAliveTimeout < now) {
                    log.log(ctx, 'Call Participant Reaped: ' + a.uid + ' from ' + a.cid);
                    a.enabled = false;
                }
            }
            return false;
        });
    });
}