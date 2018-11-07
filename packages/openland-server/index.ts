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
import { Modules } from '../openland-modules/Modules';
import { initHealthcheck } from './init/initHealthcheck';
import { Shutdown } from '../openland-utils/Shutdown';

let exitCalled = false;
async function onExit() {
    if (exitCalled) {
        process.exit();
    }
    exitCalled = true;
    await Shutdown.shutdown();
    process.exit();
}

process.on('SIGTERM', onExit);
process.on('SIGINT', onExit);

async function initServer() {
    try {
        Shutdown.onShutdownDone(() => console.log('shutdown test! 2'));
        await Modules.start();

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
