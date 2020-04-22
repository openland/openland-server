import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

interface StoppableWork {
    name: string;
    shutdown(ctx: Context): Promise<void>;
    last?: boolean;
}

const logger = createLogger('shutdown');
const ctx = createNamedContext('shutdown');
const isTesting = process.env.TESTING === 'true';
const isProd = process.env.APP_ENVIRONMENT === 'production';

class ShutdownImpl {
    private works: StoppableWork[] = [];
    private lastToStop: StoppableWork | undefined;

    registerWork(work: StoppableWork) {
        if (work.last) {
            this.lastToStop = work;
        } else {
            this.works.push(work);
        }
    }

    async shutdown() {
        if (isTesting || !isProd) {
            process.exit();
        }
        if (this.lastToStop) {
            this.works.push(this.lastToStop);
        }
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
    await Shutdown.shutdown();
}

process.on('SIGTERM', onExit);
process.on('SIGINT', () => process.exit());
