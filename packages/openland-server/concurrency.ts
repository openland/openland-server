import { BoundedConcurrencyPool } from 'openland-utils/ConcurrencyPool';
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

    // Read operation concurrency pool. Unique per transaction.
    TransactionOperations: () => new BoundedConcurrencyPool(128),

    // FoundationDB transaction pool. Unique per process.
    Transaction: new BoundedConcurrencyPool(256),

    // GQL resolve pool, unique per process
    Resolve: () => new BoundedConcurrencyPool(16),
};