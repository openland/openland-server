import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

/**
 * Manages operations like subscriptions, etc. inside one session
 */
export class VostokOperationsManager {
    public operations = new Map<string, { destroy(): void }>();

    add = (id: string, destroy: () => void) => {
        this.stop(id);
        this.operations.set(id, { destroy });
    }

    stop = (id: string) => {
        if (this.operations.has(id)) {
            this.operations.get(id)!.destroy();
            this.operations.delete(id);
        }
        log.log(rootCtx, 'attempt to stop unknown operation', id);
    }

    stopAll = () => {
        for (let op of this.operations.entries())  {
            op[1].destroy();
            this.operations.delete(op[0]);
        }
    }
}