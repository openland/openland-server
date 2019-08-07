import { createMetric } from 'openland-module-monitoring/Metric';
import { createNamedContext } from '@openland/context';

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

const metric = createMetric('event-loop-lag', 'average');
const ctx = createNamedContext('event-loop-tracing');
export function setupNodeJSTracing() {
    setInterval(async () => {
        let lag = await measureEventLoopLag();
        metric.add(ctx, lag / 1000000);
    }, 1000);
}