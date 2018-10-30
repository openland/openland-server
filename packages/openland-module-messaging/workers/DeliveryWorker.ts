import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { DB } from 'openland-server/tables';
import { Modules } from 'openland-modules/Modules';
import { Repos } from 'openland-server/repositories';

export function createDeliveryWorker() {
    let queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_delivery');
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (item) => {

            await DB.txStable(async (tx) => {
                let message = (await DB.ConversationMessage.findById(item.messageId))!;
                let conversationId = message.conversationId;
                let conv = (await DB.Conversation.findById(conversationId))!;
                let uid = message.userId;
                let members = await Repos.Chats.getConversationMembersFast(conversationId, conv, tx);
                let pending: any[] = [];

                if (members.length > 0) {
                    let currentStates = await DB.ConversationUserState.findAll({
                        where: {
                            conversationId: conversationId,
                            userId: {
                                $in: members
                            }
                        },
                        transaction: tx,
                        lock: tx.LOCK.UPDATE
                    });
                    let currentGlobals = await DB.ConversationsUserGlobal.findAll({
                        where: {
                            userId: {
                                $in: members
                            }
                        },
                        transaction: tx,
                        lock: tx.LOCK.UPDATE
                    });
                    for (let m of members) {
                        let existing = currentStates.find((v) => v.userId === m);
                        let existingGlobal = currentGlobals.find((v) => v.userId === m);
                        let userSeq = 1;
                        let userUnread = 0;
                        let userChatUnread = 0;

                        // let muted = (await this.getConversationSettings(m, conversationId)).mute;

                        // Write user's chat state
                        if (m !== uid) {
                            if (existing) {
                                existing.unread++;
                                userChatUnread = existing.unread;
                                pending.push(existing.save({ transaction: tx }));
                            } else {
                                userChatUnread = 1;
                                pending.push(DB.ConversationUserState.create({
                                    conversationId: conversationId,
                                    userId: m,
                                    unread: 1
                                }, { transaction: tx }));
                            }
                        } else {
                            if (existing) {
                                (existing as any).changed('updatedAt', true);
                                pending.push(existing.save({ transaction: tx }));
                            } else {
                                pending.push(DB.ConversationUserState.create({
                                    conversationId: conversationId,
                                    userId: m,
                                    unread: 0
                                }, { transaction: tx }));
                            }
                        }

                        // Update or Create global state
                        if (existingGlobal) {
                            if (m !== uid) {
                                existingGlobal.unread++;
                            }
                            existingGlobal.seq++;
                            userSeq = existingGlobal.seq;
                            userUnread = existingGlobal.unread;
                            pending.push(existingGlobal.save({ transaction: tx }));
                        } else {
                            if (m !== uid) {
                                userUnread = 1;
                                pending.push(DB.ConversationsUserGlobal.create({
                                    userId: m,
                                    unread: 1,
                                    seq: 1
                                }, { transaction: tx }));
                            } else {
                                userUnread = 0;
                                pending.push(DB.ConversationsUserGlobal.create({
                                    userId: m,
                                    unread: 0,
                                    seq: 1
                                }, { transaction: tx }));
                            }
                        }

                        // Write User Event
                        let _userEvent = DB.ConversationUserEvents.create({
                            userId: m,
                            seq: userSeq,
                            eventType: 'new_message',
                            event: {
                                conversationId: conversationId,
                                messageId: message.id,
                                unreadGlobal: userUnread,
                                unread: userChatUnread,
                                senderId: uid,
                                repeatKey: message.repeatToken ? message.repeatToken : null
                            }
                        }, { transaction: tx });

                        pending.push(Modules.Push.sendCounterPush(m, conversationId, userUnread));

                        pending.push(_userEvent);

                        // pending.push(messageReceived.event({ cid: conversationId }));
                    }
                }

                for (let p of pending) {
                    await p;
                }

                // Cancel Typings
                await Modules.Typings.cancelTyping(uid, conversationId, members);
            });

            // Notify augmentation worker
            await Modules.Messaging.AugmentationWorker.pushWork({ messageId: item.messageId });

            return { result: 'ok' };
        });
    }
    return queue;
}