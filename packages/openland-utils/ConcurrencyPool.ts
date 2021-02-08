import { createContextNamespace, Context } from '@openland/context';

export interface ConcurrencyPool {
    run<T>(src: () => Promise<T>): Promise<T>;
}

export const UnboundedConcurrencyPool: ConcurrencyPool = {
    run: <T>(src: () => Promise<T>) => {
        return src();
    }
};

export class BoundedConcurrencyPool implements ConcurrencyPool {
    readonly concurrencyFactor: number;
    private inFlight = 0;
    private pending: (() => void)[] = [];

    constructor(concurrencyFactor: number) {
        this.concurrencyFactor = concurrencyFactor;
    }

    async run<T>(src: () => Promise<T>): Promise<T> {
        if (this.inFlight >= this.concurrencyFactor) {
            await new Promise<void>((resolve) => this.pending.push(resolve));
        }
        this.inFlight++;
        try {
            let res = await src();
            return res;
        } finally {
            this.inFlight--;
            if (this.pending.length > 0) {
                let p = this.pending[0];
                this.pending.shift();
                p();
            }
        }
    }
}

const concurrencyPoolNamespace = createContextNamespace<ConcurrencyPool>('concurrency-pool', UnboundedConcurrencyPool);

export function withConcurrentcyPool(parent: Context, pool: ConcurrencyPool): Context {
    return concurrencyPoolNamespace.set(parent, pool);
}

export function getConcurrencyPool(ctx: Context): ConcurrencyPool {
    return concurrencyPoolNamespace.get(ctx);
}