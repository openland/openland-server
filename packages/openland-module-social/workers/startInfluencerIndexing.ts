import { updateReader } from 'openland-module-workers/updateReader';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { EmptyContext } from '@openland/context';

export function startInfluencerIndexer() {
    updateReader('influencer', 2, FDB.Message.createUpdatedStream(EmptyContext, 50), async (items, first, parent) => {
        await inTx(parent, async (ctx) => {
            for (let i of items) {
                await Modules.Social.repo.onMessageSent(ctx, i.uid);
            }
        });
    });
}