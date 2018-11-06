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
        await Promise.all(this.works.map(w => {
            return (async () => {
                logger.log('stopping', w.name);
                await w.shutdown();
            })();
        }));
        this.subs.forEach(s => s());
        logger.log('done');
    }
}

export const Shutdown = new ShutdownImpl();