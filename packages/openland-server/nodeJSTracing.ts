import { createHyperlogger } from '../openland-module-hyperlog/createHyperlogEvent';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

const lagLogger = createHyperlogger<{ lag: number }>('event_loop_lag');
const ctx = createNamedContext('nodejs-tracing');
const log = createLogger('event_loop_lag');

const hrTime = () => (process.hrtime as any).bigint() as bigint;

function measureEventLoopLag(): Promise<bigint> {
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
        await lagLogger.event(ctx, { lag: Number(lag) });
        log.log(ctx, 'lag in ms:', Number(lag / 1000000n), 'lag in ns:', Number(lag));
    }, 1000);
}