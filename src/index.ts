// AsyncIterator polyfil
if (Symbol.asyncIterator === undefined) {
    ((Symbol as any).asyncIterator) = Symbol.for('asyncIterator');
}

import { startApi } from './server';
import { initWorkers } from './workers';
import { initDatabase } from './init/initDatabase';
import { initElastic } from './init/initElastic';
import { initFiles } from './init/initFiles';
import { initTestDatabase } from './init/initTestDatabase';

var args = process.argv.splice(process.execArgv.length + 2);
if (args.indexOf('--rebuild-test') >= 0) {
    console.warn('Building test environment');
    async function rebuildTestDatabase() {
        try {
            await initDatabase();
            console.warn('Database: OK');
            await initFiles();
            console.warn('Files: OK');
            await initElastic();
            console.warn('Elastic: OK');
            await initWorkers();
            console.warn('Workers: OK');
            await initTestDatabase();
            console.warn('Data: OK');
        } catch (e) {
            console.error('Unable to init server');
            console.error(e);
            process.abort();
        }
        process.exit();
    }
    rebuildTestDatabase();
} else {
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
}