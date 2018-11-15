import { createLogger } from '../openland-log/createLogger';
import { createEmptyContext, Context } from './Context';
import { withLogContext } from 'openland-log/withLogContext';

interface StoppableWork {
    name: string;
    shutdown(ctx: Context): Promise<void>;
}

const logger = createLogger('Shutdown');

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
        let ctx = createEmptyContext();
        ctx = withLogContext(ctx, ['shutdow']);
        await Promise.all(this.works.map(w => {
            return (async () => {
                logger.log(createEmptyContext(), 'stopping', w.name);
                await w.shutdown(ctx);
            })();
        }));
        this.subs.forEach(s => s());
        logger.log(createEmptyContext(), 'done');
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

process.on('SIGTERM', onExit);
process.on('SIGINT', onExit);