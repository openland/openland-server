import { updateReader } from 'openland-module-workers/updateReader';
import { FDB } from 'openland-module-db/FDB';
import { createEmptyContext } from 'openland-utils/Context';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';

export function startConnectionsIndexer() {
    updateReader('user_connections', 2, FDB.Message.createUpdatedStream(createEmptyContext(), 50), async (items) => {
        await inTx(createEmptyContext(), async (ctx) => {
            for (let i of items) {
                let pr = await FDB.ConversationPrivate.findById(ctx, i.cid);
                if (pr) {
                    let uid2 = pr.uid1 === i.uid ? pr.uid2 : pr.uid1;
                    await Modules.Social.connections.onMessageSent(ctx, i.uid, uid2);
                }
            }
        });
    });
}