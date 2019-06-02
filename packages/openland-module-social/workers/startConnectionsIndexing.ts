import { updateReader } from 'openland-module-workers/updateReader';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { EmptyContext } from '@openland/context';

export function startConnectionsIndexer() {
    updateReader('user_connections', 3, FDB.Message.createUpdatedStream(EmptyContext, 50), async (items) => {
        await inTx(EmptyContext, async (ctx) => {
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