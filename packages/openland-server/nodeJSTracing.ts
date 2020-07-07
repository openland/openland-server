import * as os from 'os';
import { Shutdown } from '../openland-utils/Shutdown';
import { Metrics } from 'openland-module-monitoring/Metrics';

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
    let timer = setInterval(async () => {
        let lag = (await measureEventLoopLag()) / 1000000;
        Metrics.EventLoopLag.report(os.hostname(), lag);
    }, 1000);

    Shutdown.registerWork({
        name: 'node-js-tracing',
        shutdown: async () => clearInterval(timer)
    });
}
