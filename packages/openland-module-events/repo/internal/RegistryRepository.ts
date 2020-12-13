import { randomId } from 'openland-utils/randomId';
import { Context } from '@openland/context';
import { Subspace, inTx, encoders } from '@openland/foundationdb';

//
// Registry is a simple collection of existing ids and there are nothing 
// should be optimized since they are already evenly distributed.
//

const REGISTRY_FEED = 0;
const REGISTRY_SUBSCRIBERS = 1;

const ZERO = Buffer.from([]);
const ONE = Buffer.from([1]);

export class RegistryRepository {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    async allocateSubscriberId(parent: Context) {
        return await inTx(parent, async (ctx: Context) => {
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

    async allocateFeedId(parent: Context, mode: 'forward-only' | 'generic') {
        return await inTx(parent, async (ctx: Context) => {
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
                if (mode === 'forward-only') {
                    this.subspace.set(ctx, key, ONE);
                } else if (mode === 'generic') {
                    this.subspace.set(ctx, key, ZERO);
                } else {
                    throw Error('Unknown mode ' + mode);
                }

                return id;
            }
        });
    }

    async getFeed(parent: Context, feed: Buffer): Promise<null | 'generic' | 'forward-only'> {
        return await inTx(parent, async (ctx: Context) => {
            let key = encoders.tuple.pack([REGISTRY_FEED, feed]);
            let ex = await this.subspace.snapshotGet(ctx, key);
            if (!ex) {
                return null;
            } else if (ex.length === 0) {
                return 'generic';
            } else {
                return 'forward-only';
            }
        });
    }

    async subscriberExists(parent: Context, feed: Buffer) {
        return await inTx(parent, async (ctx: Context) => {
            let key = encoders.tuple.pack([REGISTRY_SUBSCRIBERS, feed]);
            return await this.subspace.snapshotExists(ctx, key);
        });
    }
}