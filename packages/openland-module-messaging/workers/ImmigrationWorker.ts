import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

export function createImmigrationWorker() {
    let reader = new UpdateReader('export-messages', 1, DB.ConversationMessage);
    reader.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {
                let existing = await FDB.Message.findById(i.id);
                if (existing) {
                    existing.text = i.message ? i.message : null;
                    existing.fileId = i.fileId ? i.fileId : null;
                    existing.fileMetadata = i.fileMetadata ? i.fileMetadata : null;
                    existing.filePreview = i.extras.filePreview ? i.extras.filePreview as any : null;
                    existing.mentions = i.extras.mentions as number[];
                    existing.replyMessages = i.extras.replyMessages as number[];
                    existing.isMuted = i.isMuted;
                    existing.isService = i.isService;
                } else {
                    await FDB.Message.create(i.id, {
                        cid: i.conversationId,
                        uid: i.userId,

                        text: i.message,
                        fileId: i.fileId,
                        fileMetadata: i.fileMetadata,
                        filePreview: i.extras.filePreview as any,

                        mentions: i.extras.mentions as number[],
                        replyMessages: i.extras.replyMessages as number[],

                        isMuted: i.isMuted,
                        isService: i.isService
                    });
                }
            });
        }
    });
    reader.start();
}