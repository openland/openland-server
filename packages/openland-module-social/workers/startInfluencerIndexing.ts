import { updateReader } from 'openland-module-workers/updateReader';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';

export function startInfluencerIndexer() {
    updateReader('influencer', 2, Store.Message.updated.stream({ batchSize: 50 }), async (args, parent) => {
        await inTx(parent, async (ctx) => {
            for (let i of args.items) {
                await Modules.Social.repo.onMessageSent(ctx, i.uid);
            }
        });
    });
}