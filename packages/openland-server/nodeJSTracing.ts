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

    let hostname = os.hostname();
    let memoryTimer = setInterval(() => {
        let memoryUsage = process.memoryUsage();
        Metrics.MemoryHeapUsed.add(hostname, memoryUsage.heapUsed, hostname, 5000);
        Metrics.MemoryHeapTotal.add(hostname, memoryUsage.heapTotal, hostname, 5000);
        Metrics.MemoryRss.add(hostname, memoryUsage.rss, hostname, 5000);
        Metrics.MemoryExternal.add(hostname, memoryUsage.external, hostname, 5000);
        Metrics.MemoryArrayBuffers.add(hostname, memoryUsage.arrayBuffers, hostname, 5000);
        Metrics.MemoryNative.add(hostname, memoryUsage.rss - memoryUsage.arrayBuffers - memoryUsage.heapTotal - memoryUsage.external, hostname, 5000);
    }, 1000);

    let timer = setInterval(async () => {
        let lag = (await measureEventLoopLag()) / 1000000;
        Metrics.EventLoopLag.report(os.hostname(), lag);
    }, 1000);

    Shutdown.registerWork({
        name: 'node-js-tracing',
        shutdown: async () => {
            clearInterval(timer);
            clearInterval(memoryTimer);
        }
    });
}
