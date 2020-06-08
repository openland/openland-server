// Reflection support
import 'reflect-metadata';

// Async Iterator polyfil
if (Symbol.asyncIterator === undefined) {
    ((Symbol as any).asyncIterator) = Symbol.for('asyncIterator');
}

// Register Modules
require('module-alias/register');

// Context Patching
import './context';

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
import { Config } from 'openland-config/Config';

const logger = createLogger('startup');

function assert(expected: string, got: string) {
    if (expected !== got) {
        throw Error('Config error. Expected: ' + expected + ', got: ' + got);
    }
}

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

    // Check for production config
    if (Config.environment === 'production') {
        if (process.env.TWILIO_SID) {
            assert(process.env.TWILIO_SID, Config.twillio.sid);
        }
        if (process.env.TWILIO_TOKEN) {
            assert(process.env.TWILIO_TOKEN, Config.twillio.token);
        }
        if (process.env.STRIPE_SK) {
            assert(process.env.STRIPE_SK, Config.stripe.secret);
        }
        if (process.env.STRIPE_PK) {
            assert(process.env.STRIPE_PK, Config.stripe.public);
        }
        if (process.env.STRIPE_PK) {
            assert(process.env.STRIPE_PK, Config.stripe.public);
        }
        if (process.env.ELASTIC_ENDPOINT) {
            assert(process.env.ELASTIC_ENDPOINT, Config.elasticsearch.endpoint);
        }
    }

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
