import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { DB } from 'openland-server/tables';
import { Modules } from 'openland-modules/Modules';
import { Repos } from 'openland-server/repositories';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { createTracer } from 'openland-log/createTracer';
import { withTracing } from 'openland-log/withTracing';
import { trace } from 'openland-log/trace';

const tracer = createTracer('message-delivery');

export function createDeliveryWorker() {
    let queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_delivery');
    if (serverRoleEnabled('delivery')) {
        queue.addWorker(async (item) => {

            await withTracing(tracer, 'delivery', async () => {
                await inTx(async () => {
                    let message = (await FDB.Message.findById(item.messageId))!;
                    let conversationId = message.cid;
                    let conv = (await DB.Conversation.findById(conversationId))!;
                    let uid = message.uid;
                    let members = await Repos.Chats.getConversationMembersFast(conversationId, conv);

                    // Cancel Typings
                    await Modules.Typings.cancelTyping(uid, conversationId, members);

                    // Notify augmentation worker
                    await Modules.Messaging.AugmentationWorker.pushWork({ messageId: item.messageId });

                    // Deliver messages
                    if (members.length > 0) {
                        for (let m of members) {
                            await trace(tracer, 'member', async () => {
                                let existing = await Modules.Messaging.repo.getUserDialogState(m, conversationId);
                                let existingGlobal = await Modules.Messaging.repo.getUserMessagingState(m);

                                // Write user's chat state
                                if (m !== uid) {
                                    existing.unread++;
                                }

                                // Update dialog date
                                existing.date = message.createdAt;

                                // Update global counters
                                if (m !== uid) {
                                    existingGlobal.unread++;
                                }
                                existingGlobal.seq++;

                                // Write User Event
                                await FDB.UserDialogEvent.create(m, existingGlobal.seq, {
                                    kind: 'message_received',
                                    cid: conversationId,
                                    mid: message.id,
                                    allUnread: existingGlobal.unread,
                                    unread: existing.unread
                                });

                                // Send counter push notification to iOS
                                await Modules.Push.sendCounterPush(m, conversationId, existingGlobal.unread);
                            });
                        }
                    }
                });
            });

            return { result: 'ok' };
        });
    }
    return queue;
}