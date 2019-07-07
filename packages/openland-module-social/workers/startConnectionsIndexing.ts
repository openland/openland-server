import { updateReader } from 'openland-module-workers/updateReader';
import { FDB, Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';

export function startConnectionsIndexer() {
    updateReader('user_connections', 3, FDB.Message.createUpdatedStream(50), async (items, first, parent) => {
        await inTx(parent, async (ctx) => {
            for (let i of items) {
                let pr = await Store.ConversationPrivate.findById(ctx, i.cid);
                if (pr) {
                    let uid2 = pr.uid1 === i.uid ? pr.uid2 : pr.uid1;
                    await Modules.Social.connections.onMessageSent(ctx, i.uid, uid2);
                }
            }
        });
    });
}