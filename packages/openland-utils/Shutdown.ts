import { createLogger } from '../openland-log/createLogger';

interface StoppableWork {
    name: string;
    shutdown(): Promise<void>;
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
        for (let work of this.works) {
            logger.log('stopping', work.name);
            await work.shutdown();
        }
        this.subs.forEach(s => s());
        logger.log('done');
    }
}

export const Shutdown = new ShutdownImpl();