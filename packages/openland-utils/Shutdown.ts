import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

interface StoppableWork {
    name: string;
    shutdown(ctx: Context): Promise<void>;
}

const logger = createLogger('shutdown');
const ctx = createNamedContext('shutdown');
const isTesting = process.env.TESTING === 'true';

class ShutdownImpl {
    private works: StoppableWork[] = [];

    registerWork(work: StoppableWork) {
        this.works.push(work);
    }

    async shutdown() {
        for (let work of this.works) {
            logger.log(ctx, 'stopping', work.name);
            await work.shutdown(ctx);
            logger.log(ctx, 'stopped', work.name);
        }
        logger.log(ctx, 'done');
        process.exit();
    }
}

export const Shutdown = new ShutdownImpl();

async function onExit() {
    if (isTesting) {
        process.exit();
    }
    await Shutdown.shutdown();
}

process.on('SIGTERM', onExit);
process.on('SIGINT', () => process.exit());
