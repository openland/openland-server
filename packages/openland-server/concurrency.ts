import { BoundedConcurrencyPool, ConcurrencyPool } from 'openland-utils/ConcurrencyPool';
import { SimpleFactory } from 'openland-utils/SimpleFactory';
import { TokenBucket } from 'openland-utils/TokenBucket';

export const Concurrency = {
    // Operation rate limiting. Unique for each connection.
    Operation: new SimpleFactory(() => {
        return new TokenBucket({
            maxTokens: 64,
            refillDelay: 100,
            refillAmount: 10
        });
    }),

    // Parallel operation execution pool. Unique for each connection.
    Execution: new SimpleFactory(() => {
        return new BoundedConcurrencyPool(128) as ConcurrencyPool;
    }),

    // FoundationDB operation pool. Unique per authentication token.
    FDB: new SimpleFactory(() => {
        return new BoundedConcurrencyPool(512) as ConcurrencyPool;
    }),

    // Read operation concurrency pool. Unique per transaction.
    FDBTransacton: () => new BoundedConcurrencyPool(64),

    // // FoundationDB transaction pool. Unique per process.
    // Transaction: new BoundedConcurrencyPool(100),

    // GQL resolve pool, unique per machine
    Resolve: new BoundedConcurrencyPool(100) as ConcurrencyPool,

    // Should be avoided
    Default: new BoundedConcurrencyPool(16) as ConcurrencyPool
};