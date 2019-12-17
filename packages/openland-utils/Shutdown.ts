import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

interface StoppableWork {
    name: string;
    shutdown(ctx: Context): Promise<void>;
}

const logger = createLogger('shutdown');
let ctx = createNamedContext('shutdown');

class ShutdownImpl {
    private works: StoppableWork[] = [];
    private subs: (() => void)[] = [];

    registerWork(work: StoppableWork) {
        this.works.push(work);
    }

    onShutdownDone(listener: () => void) {
        this.subs.push(listener);
    }

    async shutdown() {
        await Promise.all(this.works.map(w => {
            return (async () => {
                logger.log(ctx, 'stopping', w.name);
                await w.shutdown(ctx);
            })();
        }));
        this.subs.forEach(s => s());
        logger.log(ctx, 'done');
    }
}

export const Shutdown = new ShutdownImpl();

let exitCalled = false;
async function onExit() {
    if (exitCalled) {
        process.exit();
    }
    exitCalled = true;
    await Shutdown.shutdown();
    process.exit();
}

process.stdin.resume();

process.on('exit', onExit);
process.on('SIGTERM', onExit);
process.on('SIGINT', onExit);