import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export function startMigrator() {
    let reader = new UpdateReader('conv-events-export', 1, DB.ConversationEvent);
    reader.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {
                if (await FDB.ConversationEvent.findById(i.conversationId, i.seq)) {
                    return;
                }
                if (i.eventType === 'new_message') {
                    await FDB.ConversationEvent.create(i.conversationId, i.seq, {
                        kind: 'message_received',
                        mid: i.event.messageId as number
                    });
                } else if (i.eventType === 'edit_message') {
                    await FDB.ConversationEvent.create(i.conversationId, i.seq, {
                        kind: 'message_updated',
                        mid: i.event.messageId as number
                    });
                } else if (i.eventType === 'delete_message') {
                    await FDB.ConversationEvent.create(i.conversationId, i.seq, {
                        kind: 'message_deleted',
                        mid: i.event.messageId as number
                    });
                }
            });
        }
    });
    reader.start();

    let reader2 = new UpdateReader('conv-events-seqs', 1, DB.Conversation);
    reader2.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {
                let seq = await FDB.ConversationSeq.findById(i.id);
                if (seq) {
                    seq.seq = i.seq;
                } else {
                    await FDB.ConversationSeq.create(i.id, { seq: i.seq });
                }
            });
        }
    });
    reader2.start();
}