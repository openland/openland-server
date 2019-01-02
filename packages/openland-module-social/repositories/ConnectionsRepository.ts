import { injectable } from 'inversify';
import { Context } from 'openland-utils/Context';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
// import { createLogger } from 'openland-log/createLogger';

// const log = createLogger('connections');

@injectable()
export class ConnectionsRepository {
    onMessageSent = async (parent: Context, fromUid: number, toUid: number) => {
        await inTx(parent, async (ctx) => {
            if (!await FDB.UserEdge.findById(ctx, fromUid, toUid)) {
                await FDB.UserEdge.create(ctx, fromUid, toUid, {});
                let infind = await FDB.UserInfluencerUserIndex.findById(ctx, toUid);
                if (infind) {
                    infind.value++;
                } else {
                    await FDB.UserInfluencerUserIndex.create(ctx, toUid, { value: 1 });
                }
            }
        });
    }
}