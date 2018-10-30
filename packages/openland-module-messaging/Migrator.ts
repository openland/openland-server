import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export function startDialogStatsExporting() {
    let reader = new UpdateReader('export_dialog_states', 1, DB.ConversationUserState);
    reader.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {
                let existing = await FDB.UserDialog.findById(i.userId, i.conversationId);
                if (existing) {
                    existing.date = i.updatedAt.getTime();
                    existing.unread = i.unread;
                    existing.readMessageId = i.readDate;
                } else {
                    await FDB.UserDialog.create(i.userId, i.conversationId, {
                        date: i.updatedAt.getTime(),
                        unread: i.unread,
                        readMessageId: i.readDate
                    });
                }
            });
        }
        //
    });
    reader.start();
}