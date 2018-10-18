require('module-alias/register');

// AsyncIterator polyfil
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';

if (Symbol.asyncIterator === undefined) {
    ((Symbol as any).asyncIterator) = Symbol.for('asyncIterator');
}

import Raven from 'raven';
if (process.env.NODE_ENV !== 'development') {
    Raven.config('https://8fd3799350f74171b901606ddda8d91d@sentry.io/1236375').install();
}

// if (process.env.NODE_ENV !== 'development') {
//     require('honeycomb-beeline')({
//         writeKey: 'c68b018d01f9ca0a8a52239acea0ebb8',
//         dataset: 'node-js'
//     });
// }

import { initApi } from './init/initApi';
import { initWorkers } from './workers';
import { initDatabase } from './init/initDatabase';
import { initElastic } from './init/initElastic';
import { initFiles } from './init/initFiles';
import initTestDatabase from './tests/data';
import './init/initConfig';
import { performMigrations } from 'openland-migrations';
import { Modules } from '../openland-modules/Modules';

if (process.argv.indexOf('--rebuild-test') >= 0) {
    console.warn('Building test environment');
    async function rebuildTestDatabase() {
        try {
            await initDatabase(true, true);
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
            await initDatabase(false, false);
            Modules.start();
            await initFiles();
            if (serverRoleEnabled('indexing')) {
                await initElastic();
            }
            await initWorkers();
            
            performMigrations();
            if (serverRoleEnabled('api')) {
                await initApi(false);
            }
        } catch (e) {
            console.error('Unable to init server');
            console.error(e);
            process.abort();
        }
    }

    initServer();
}