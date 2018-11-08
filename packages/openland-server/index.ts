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

// Register graceful shutdown
import '../openland-utils/Shutdown';

import { Modules } from '../openland-modules/Modules';
async function initServer() {
    try {
        await Modules.start();
    } catch (e) {
        console.error('Unable to init server');
        console.error(e);
        process.abort();
    }
}

// tslint:disable-next-line:no-floating-promises
initServer();
