import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { DB } from 'openland-server/tables';
import { Modules } from 'openland-modules/Modules';
import { Repos } from 'openland-server/repositories';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

export function createDeliveryWorker() {
    let queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_delivery');
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (item) => {
            await inTx(async () => {
                let message = (await DB.ConversationMessage.findById(item.messageId))!;
                let conversationId = message.conversationId;
                let conv = (await DB.Conversation.findById(conversationId))!;
                let uid = message.userId;
                let members = await Repos.Chats.getConversationMembersFast(conversationId, conv);

                // Cancel Typings
                await Modules.Typings.cancelTyping(uid, conversationId, members);

                // Notify augmentation worker
                await Modules.Messaging.AugmentationWorker.pushWork({ messageId: item.messageId });

                // Deliver messages
                if (members.length > 0) {
                    for (let m of members) {
                        let existing = await Modules.Messaging.repo.getUserDialogState(m, conversationId);
                        let existingGlobal = await Modules.Messaging.repo.getUserMessagingState(m);

                        // Write user's chat state
                        if (m !== uid) {
                            existing.unread++;
                        }

                        // Update dialog date
                        existing.date = message.createdAt.getTime();

                        // Update global counters
                        if (m !== uid) {
                            existingGlobal.unread++;
                        }
                        existingGlobal.seq++;

                        // Write User Event
                        await FDB.UserDialogEvent.create(m, existingGlobal.seq, {
                            kind: 'message_received',
                            cid: conversationId,
                            sid: uid,
                            mid: message.id,
                            allUnread: existingGlobal.unread,
                            unread: existing.unread
                        });

                        // Send counter push notification to iOS
                        await Modules.Push.sendCounterPush(m, conversationId, existingGlobal.unread);
                    }
                }
            });

            return { result: 'ok' };
        });
    }
    return queue;
}