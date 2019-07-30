import { createHyperlogger } from '../openland-module-hyperlog/createHyperlogEvent';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

const lagLogger = createHyperlogger<{ lag_ns: number, lag_ms: number }>('event_loop_lag');
const ctx = createNamedContext('nodejs-tracing');
const log = createLogger('event_loop_lag');

function hrTime() {
    let t = process.hrtime();
    return (t[0] * 1e9) + t[1];
}

function measureEventLoopLag(): Promise<number> {
    return new Promise(resolve => {
        let start = hrTime();
        setTimeout(() => {
            resolve(hrTime() - start);
        }, 0);
    });
}

export function setupNodeJSTracing() {
    setInterval(async () => {
        let lag = await measureEventLoopLag();
        await lagLogger.event(ctx, { lag_ns: lag, lag_ms: lag / 1000000 });
        log.log(ctx, 'lag in ms:', lag / 1000000, 'lag in ns:', lag);
    }, 1000);
}