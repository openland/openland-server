import { Store } from './../../openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { createTracer } from 'openland-log/createTracer';

const tracer = createTracer('calls');

export function startCallReaper() {
    singletonWorker({ db: Store.storage.db, name: 'call-reaper', delay: 1000 }, async (parent) => {
        await tracer.trace(parent, 'reaper', (c) => Modules.Calls.repo.checkTimeouts(c));
    });
}