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
            if (!await Store.UserEdge.findById(ctx, fromUid, toUid)) {
                await Store.UserEdge.create(ctx, fromUid, toUid, {});
                let infind = await Store.UserInfluencerUserIndex.findById(ctx, toUid);
                if (infind) {
                    infind.value++;
                } else {
                    await Store.UserInfluencerUserIndex.create(ctx, toUid, { value: 1 });
                }
            }
        });
    }
}