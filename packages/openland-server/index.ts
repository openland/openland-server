// Reflection support
import 'reflect-metadata';

// Async Iterator polyfil
if (Symbol.asyncIterator === undefined) {
    ((Symbol as any).asyncIterator) = Symbol.for('asyncIterator');
}

// Register Modules
require('module-alias/register');

// Register crash reporting
import Raven from 'raven';
if (process.env.NODE_ENV !== 'development') {
    Raven.config('https://8fd3799350f74171b901606ddda8d91d@sentry.io/1236375').install();
}

// const stackimpact = require('stackimpact');
// stackimpact.start({
//     agentKey: 'ca9a1cbfb9729865ae71c94c0646205f2a991caf',
//     appName: 'Openland',
// });

// Register graceful shutdown
import '../openland-utils/Shutdown';

import { loadAllModules } from 'openland-modules/loadAllModules';
async function initServer() {
    try {
        await loadAllModules();
    } catch (e) {
        console.error('Unable to init server');
        console.error(e);
        process.abort();
    }
}

// tslint:disable-next-line:no-floating-promises
initServer();
