import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export function startMigrator() {
    let reader = new UpdateReader('export-messages', 1, DB.ConversationMessage);
    reader.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {
                let msg = await FDB.Message.findById(i.id);
                if (!msg) {
                    let id = await FDB.Sequence.findById('message-id');
                    if (id) {
                        id.value = Math.max(id.value, i.id);
                    } else {
                        await FDB.Sequence.create('message-id', { value: i.id });
                    }
                    await FDB.Message.create(i.id, {
                        cid: i.conversationId,
                        uid: i.userId,

                        // Content
                        isService: i.isService,
                        text: i.message,
                        fileId: i.fileId,
                        fileMetadata: i.fileMetadata,
                        serviceMetadata: i.extras.serviceMetadata || null,
                        replyMessages: i.extras.replyMessages ? i.extras.replyMessages : null,
                        mentions: i.extras.mentions ? i.extras.mentions : null,
                        augmentation: i.extras.urlAugmentation || null,

                        // State
                        repeatKey: i.repeatToken,
                        isMuted: i.isMuted,
                        deleted: !!i.deletedAt
                    });
                } else {
                    msg.text = i.message ? i.message : null;
                    msg.fileId = i.fileId ? i.fileId : null;
                    msg.fileMetadata = i.fileMetadata ? i.fileMetadata : null;
                    msg.replyMessages = i.extras.replyMessages ? i.extras.replyMessages : null;
                    msg.mentions = i.extras.mentions ? i.extras.mentions : null;
                    msg.augmentation = i.extras.urlAugmentation ? i.extras.urlAugmentation : null;
                    msg.deleted = !!i.deletedAt;
                }
            });
        }
    });
    reader.start();
}