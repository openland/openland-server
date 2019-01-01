import { updateReader } from 'openland-module-workers/updateReader';
import { FDB } from 'openland-module-db/FDB';
import { createEmptyContext } from 'openland-utils/Context';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';

export function startInfluencerIndexer() {
    updateReader('influencer', 2, FDB.Message.createUpdatedStream(createEmptyContext(), 50), async (items) => {
        await inTx(createEmptyContext(), async (ctx) => {
            for (let i of items) {
                await Modules.Social.repo.onMessageSent(ctx, i.uid);
            }
        });
    });
}