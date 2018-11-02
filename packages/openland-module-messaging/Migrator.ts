import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

export function startMigrator() {
    let reader = new UpdateReader('export-members', 3, DB.ConversationGroupMembers);
    reader.processor(async (items) => {
        for (let i of items) {

            // FDB.Conversation.findById(i.id);
            await inTx(async () => {
                let p = await FDB.RoomParticipant.findById(i.conversationId, i.userId);
                if (!p) {
                    await FDB.RoomParticipant.create(i.conversationId, i.userId, {
                        role:
                            (i.role === 'admin')
                                ? 'admin'
                                : (i.role === 'creator')
                                    ? 'owner'
                                    : 'member',
                        invitedBy: i.invitedById,
                        status:
                            (i.status === 'requested')
                                ? 'requested'
                                : (i.status === 'member')
                                    ? 'joined'
                                    : 'kicked'
                    });
                } else {
                    p.markDirty();
                }
            });
        }
    });
    reader.start();
}