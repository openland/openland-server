import { staticWorker } from '../modules/staticWorker';
import { DB } from '../tables';
import { Log } from '../Log';

export function startCallReaperWorker() {
    staticWorker({ name: 'call_reaper', delay: 3000 }, async (tx) => {
        let now = new Date();
        let killed = false;
        let timeouted = await DB.PrivateCall.findAll({
            where: {
                active: true,
                calleeTimeout: {
                    $lt: now
                },
            },
            lock: tx.LOCK.UPDATE, 
            logging: false
        });
        for (let t of timeouted) {
            killed = true;
            t.active = false;
            Log.Calls.log('[' + t.id + '] Call timeouted');
            await t.save({ transaction: tx, logging: false });
        }
        timeouted = await DB.PrivateCall.findAll({
            where: {
                active: true,
                callerTimeout: {
                    $lt: now
                },
            },
            lock: tx.LOCK.UPDATE,
            logging: false
        });
        for (let t of timeouted) {
            killed = true;
            t.active = false;
            Log.Calls.log('[' + t.id + '] Call timeouted');
            await t.save({ transaction: tx, logging: false });
        }
        return killed;
    });
}