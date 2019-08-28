import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
// import { createLogger } from 'openland-log/createLogger';

// const log = createLogger('connections');

@injectable()
export class ConnectionsRepository {
    onMessageSent = async (parent: Context, fromUid: number, toUid: number) => {
        await inTx(parent, async (ctx) => {
            let edge = await Store.UserEdge.findById(ctx, fromUid, toUid);
            if (!edge) {
                await Store.UserEdge.create(ctx, fromUid, toUid, {
                    weight: 1
                });

                let infind = await Store.UserInfluencerUserIndex.findById(ctx, toUid);
                if (infind) {
                    infind.value++;
                } else {
                    await Store.UserInfluencerUserIndex.create(ctx, toUid, { value: 1 });
                }
            } else {
                edge.weight = (edge.weight || 0) + 1;
                await edge.flush(ctx);
            }
        });
    }

    onGroupMessageSent = async (parent: Context, fromUid: number, toCid: number) => {
        await inTx(parent, async (ctx) => {
            let edge = await Store.UserGroupEdge.findById(ctx, fromUid, toCid);
            if (!edge) {
                await Store.UserGroupEdge.create(ctx, fromUid, toCid, { weight: 1 });
            } else {
                edge.weight = (edge.weight || 0) + 1;
                await edge.flush(ctx);
            }
        });
    }
}