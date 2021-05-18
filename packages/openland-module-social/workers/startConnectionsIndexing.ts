import { updateReader } from 'openland-module-workers/updateReader';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';

export function startConnectionsIndexer() {
    updateReader('user_connections', 4, Store.Message.updated.stream({ batchSize: 50 }), async (args, parent) => {
        await inTx(parent, async (ctx) => {
            for (let i of args.items) {
                let pr = await Store.ConversationPrivate.findById(ctx, i.cid);
                if (pr) {
                    let uid2 = pr.uid1 === i.uid ? pr.uid2 : pr.uid1;
                    await Modules.Social.connections.onMessageSent(ctx, i.uid, uid2);
                } else {
                    await Modules.Social.connections.onGroupMessageSent(ctx, i.uid, i.cid);
                }
            }
        });
    });
}