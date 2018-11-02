require('module-alias/register');

// require('blocked-at')((time: number, stack: string) => {
//     console.log(`Blocked for ${time} ms, operation started here:`, stack);
// });

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
import { initDatabase } from './init/initDatabase';
import { initElastic } from './init/initElastic';
import './init/initConfig';
import { Modules } from '../openland-modules/Modules';
import { initHealthcheck } from './init/initHealthcheck';

async function initServer() {
    try {
        await initDatabase(false, false);
        Modules.start();
        if (serverRoleEnabled('workers')) {
            await initElastic();
        }

        if (serverRoleEnabled('api')) {
            await initApi(false);
        } else {
            if (!serverRoleEnabled('admin')) {
                await initHealthcheck();
            }
        }
    } catch (e) {
        console.error('Unable to init server');
        console.error(e);
        process.abort();
    }
}

// tslint:disable-next-line:no-floating-promises
initServer();
