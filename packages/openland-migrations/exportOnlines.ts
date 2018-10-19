import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

export const onlineExport = () => {
    let reader = new UpdateReader('online_export', 1, DB.UserPresence);
    reader.processor(async (data) => {
        await inTx(async () => {
            for (let t of data) {
                if (!await FDB.Presence.findById(t.userId, t.tokenId)) {
                    await FDB.Presence.create(
                        t.userId,
                        t.tokenId,
                        {
                            lastSeen: t.lastSeen.getTime(),
                            lastSeenTimeout: t.lastSeenTimeout.getTime(),
                            platform: t.platform || 'unknown'
                        }
                    );
                }
            }
        });
    });
    let reader2 = new UpdateReader('online_user_export', 1, DB.User);
    reader2.processor(async (data) => {
        await inTx(async () => {
            for (let t of data) {
                if (!await FDB.Online.findById(t.id!)) {
                    if (t.lastSeen) {
                        await FDB.Online.create(
                            t.id!,
                            {
                                lastSeen: t.lastSeen!.getTime(),
                            }
                        );
                    }

                }
            }
        });
    });
    return reader;
};