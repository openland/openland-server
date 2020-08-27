import { asyncRun } from 'openland-utils/timer';

export function startAsyncInterval(handler: () => Promise<void>, ms: number): () => Promise<void> {
    let stopped = false;
    let executing = false;
    let timer: NodeJS.Timer | null = null;
    let releaser: (() => void) | null = null;

    function scheduleExecution() {
        timer = setTimeout(() => {
            timer = null;
            if (stopped) {
                return;
            }
            executing = true;
            asyncRun(async () => {
                try {
                    await handler();
                } finally {
                    executing = false;
                    if (!stopped) {
                        scheduleExecution();
                    } else {
                        if (releaser) {
                            releaser();
                        }
                    }
                }
            });
        }, ms);
    }

    scheduleExecution();

    return async () => {
        stopped = true;
        if (!executing) {
            return;
        }
        await new Promise((r) => releaser = r);
    };
}