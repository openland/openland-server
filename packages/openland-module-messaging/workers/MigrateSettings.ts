import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export function startSettingsMigrator() {
    let q1 = new UpdateReader('chat-user-state-import', 0, DB.ConversationsUserGlobal);
    q1.processor(async (items) => {
        for (let i = 0; i < items.length; i++) {
            let lastEmailNotification = items[i].lastEmailNotification && items[i].lastEmailNotification!.getTime();
            await inTx(async () => {
                let existing = await FDB.UserNotificationsState.findById(items[i].userId!);
                if (existing) {
                    existing.readSeq = items[i].readSeq;
                    existing.lastEmailNotification = lastEmailNotification;
                    existing.lastEmailSeq = items[i].lastEmailSeq;
                    existing.lastPushSeq = items[i].lastPushSeq;
                } else {
                    await FDB.UserNotificationsState.create(items[i].userId!, {
                        readSeq: items[i].readSeq,
                        lastEmailNotification: lastEmailNotification,
                        lastEmailSeq: items[i].lastEmailSeq,
                        lastPushSeq: items[i].lastPushSeq
                    });
                }
            });
        }
    });
    q1.start();

    let q2 = new UpdateReader('chat-user-state-import-2', 0, DB.ConversationsUserGlobalNotifications);
    q2.processor(async (items) => {
        for (let i = 0; i < items.length; i++) {
            let lastPushNotification = items[i].lastPushNotification && items[i].lastPushNotification!.getTime();
            await inTx(async () => {
                let existing = await FDB.UserNotificationsState.findById(items[i].userId!);
                if (existing) {
                    existing.lastPushNotification = lastPushNotification;
                } else {
                    await FDB.UserNotificationsState.create(items[i].userId!, {
                        lastPushNotification: lastPushNotification
                    });
                }
            });
        }
    });
    q1.start();
}