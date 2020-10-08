import { randomId } from 'openland-utils/randomId';
import { Context } from '@openland/context';
import { Subspace, inTxLeaky, encoders } from '@openland/foundationdb';

//
// Registry is a simple collection of existing ids and there are nothing 
// should be optimized since they are already evenly distributed.
//

const REGISTRY_FEED = 0;
const REGISTRY_SUBSCRIBERS = 1;

const ZERO = Buffer.alloc(0);

export class RegistryRepository {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    async allocateSubscriberId(parent: Context) {
        return await inTxLeaky(parent, async (ctx: Context) => {
            while (true) {
                // Create unique random id for a subscriber for even data distribution
                let id = randomId();
                let key = encoders.tuple.pack([REGISTRY_SUBSCRIBERS, id]);

                // Just in case - check that id is not used already
                if (await this.subspace.snapshotExists(ctx, key)) {
                    continue;
                }

                // Save registered id
                this.subspace.addReadConflictKey(ctx, key);
                this.subspace.set(ctx, key, ZERO);

                return id;
            }
        });
    }

    async allocateFeedId(parent: Context) {
        return await inTxLeaky(parent, async (ctx: Context) => {
            while (true) {
                // Create unique random id for a subscriber for even data distribution
                let id = randomId();
                let key = encoders.tuple.pack([REGISTRY_FEED, id]);

                // Just in case - check that id is not used already
                if (await this.subspace.snapshotExists(ctx, key)) {
                    continue;
                }

                // Save registered id
                this.subspace.addReadConflictKey(ctx, key);
                this.subspace.set(ctx, key, ZERO);

                return id;
            }
        });
    }

    async feedExists(parent: Context, feed: Buffer) {
        return await inTxLeaky(parent, async (ctx: Context) => {
            let key = encoders.tuple.pack([REGISTRY_FEED, feed]);
            return await this.subspace.snapshotExists(ctx, key);
        });
    }

    async subscriberExists(parent: Context, feed: Buffer) {
        return await inTxLeaky(parent, async (ctx: Context) => {
            let key = encoders.tuple.pack([REGISTRY_SUBSCRIBERS, feed]);
            return await this.subspace.snapshotExists(ctx, key);
        });
    }
}