// AsyncIterator polyfil
if (Symbol.asyncIterator === undefined) {
    ((Symbol as any).asyncIterator) = Symbol.for('asyncIterator');
}

import { startApi } from './server';
import { initWorkers } from './workers';
import { initDatabase } from './init/initDatabase';
import { initElastic } from './init/initElastic';
import { initFiles } from './init/initFiles';

async function initServer() {
    try {
        await initDatabase();
        await initFiles();
        await initElastic();
        await initWorkers();
        await startApi();
    } catch (e) {
        console.error('Unable to init server');
        console.error(e);
        process.abort();
    }
}

initServer();