// Reflection support
import 'reflect-metadata';

// Async Iterator polyfil
if (Symbol.asyncIterator === undefined) {
    ((Symbol as any).asyncIterator) = Symbol.for('asyncIterator');
}

// Register Modules
require('module-alias/register');

// Logs
import './logs';

// Register crash reporting
// import Raven from 'raven';
// if (process.env.NODE_ENV !== 'development') {
//     Raven.config('https://8fd3799350f74171b901606ddda8d91d@sentry.io/1236375').install();
// }

// Register graceful shutdown
import '../openland-utils/Shutdown';

import { loadAllModules, startAllModules } from 'openland-modules/loadAllModules';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { setupFdbTracing } from './fdbTracing';
import { setupNodeJSTracing } from './nodeJSTracing';
const logger = createLogger('startup');

async function initServer() {
    let ctx = createNamedContext('launcher');
    process.on('unhandledRejection', (reason, promise) => {
        logger.error(ctx, 'unhandledRejection', reason, promise);
    });
    // WTF with typings?
    process.on('uncaughtException' as any, (err: any, origin: any) => {
        logger.error(ctx, 'uncaughtException', err, origin);
        process.exit(1);
    });

    try {
        logger.log(ctx, 'Loading modules');
        await loadAllModules(ctx);
        logger.log(ctx, 'Starting modules');
        await startAllModules(ctx);
        logger.log(ctx, 'Starting tracing');
        setupFdbTracing();
        setupNodeJSTracing();
        logger.log(ctx, 'Started');
    } catch (e) {
        logger.error(ctx, e, 'Unable to init server');
        process.abort();
    }
}

// tslint:disable-next-line:no-floating-promises
initServer();
