import { logger } from './logs';

// const lagLogger = createHyperlogger<{ lag_ns: number, lag_ms: number }>('event_loop_lag');
// const ctx = createNamedContext('nodejs-tracing');
const isProduction = process.env.NODE_ENV === 'production';

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
        let message = `event loop lag: ${lag} ns, ${lag / 1000000} ms `;
        if (isProduction) {
            logger.info({
                app: {
                    service: 'event_loop_lag',
                    text: message,
                    lag_ns: lag,
                    lag_ms: lag / 1000000
                },
                message
            });
        } else {
            logger.info(message);
        }
    }, 1000);
}