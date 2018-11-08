require('module-alias/register');
if (Symbol.asyncIterator === undefined) {
    ((Symbol as any).asyncIterator) = Symbol.for('asyncIterator');
}
import Raven from 'raven';
if (process.env.NODE_ENV !== 'development') {
    Raven.config('https://8fd3799350f74171b901606ddda8d91d@sentry.io/1236375').install();
}

import '../openland-utils/Shutdown';
import { Modules } from '../openland-modules/Modules';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { initApi } from './init/initApi';
import { initHealthcheck } from './init/initHealthcheck';

async function initServer() {
    try {
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
