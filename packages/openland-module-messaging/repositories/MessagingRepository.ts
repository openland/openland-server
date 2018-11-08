import { AllEntities, ConversationEvent } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { MessageInput } from 'openland-module-messaging/MessageInput';
import { AccessDeniedError } from 'openland-server/errors/AccessDeniedError';

export class MessagingRepository {
    readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async sendMessage(conversationId: number, uid: number, message: MessageInput): Promise<ConversationEvent> {
        return await inTx(async () => {
            if (message.message === 'fuck') {
                throw Error('');
            }

            //
            // Check access
            //
            await Modules.Messaging.conv.checkAccess(uid, conversationId);

            // 
            // Persist Messages
            //
            let mid = await Modules.Messaging.repo.fetchNextMessageId();
            await this.entities.Message.create(mid, {
                cid: conversationId,
                uid: uid,
                isMuted: message.isMuted || false,
                isService: message.isService || false,
                fileId: message.file,
                fileMetadata: message.fileMetadata,
                text: message.message,
                serviceMetadata: message.serviceMetadata || null,
                augmentation: message.urlAugmentation,
                replyMessages: message.replyMessages,
                mentions: message.mentions,
                repeatKey: message.repeatKey,
                deleted: false
            });

            //
            // Persist Event
            //
            let seq = await this.fetchConversationNextSeq(conversationId);
            let res = await this.entities.ConversationEvent.create(conversationId, seq, {
                kind: 'message_received',
                mid: mid
            });
            return res;
        });
    }

    async editMessage(messageId: number, uid: number, newMessage: MessageInput, markAsEdited: boolean): Promise<ConversationEvent> {
        return await inTx(async () => {
            let message = await this.entities.Message.findById(messageId);

            if (!message) {
                throw new Error('Message not found');
            }

            if (message.uid !== uid) {
                throw new AccessDeniedError();
            }

            if (newMessage.message) {
                message.text = newMessage.message;
            }
            if (newMessage.file) {
                message.fileId = newMessage.file;
            }
            if (newMessage.fileMetadata) {
                message.fileMetadata = newMessage.fileMetadata;
            }
            // if (newMessage.filePreview) {
            //     (message as any).changed('extras', true);
            //     message.extras.filePreview = newMessage.filePreview;
            // }
            if (newMessage.replyMessages) {
                message.replyMessages = newMessage.replyMessages;
            }
            if (newMessage.urlAugmentation || newMessage.urlAugmentation === null) {
                message.augmentation = newMessage.urlAugmentation;
            }
            if (newMessage.mentions) {
                message.mentions = newMessage.mentions;
            }

            if (markAsEdited) {
                message.edited = true;
            }

            let members = await Modules.Messaging.conv.findConversationMembers(message.cid);
            for (let member of members) {
                let global = await Modules.Messaging.repo.getUserMessagingState(member);
                global.seq++;
                await this.entities.UserDialogEvent.create(member, global.seq, {
                    kind: 'message_updated',
                    mid: message!.id
                });
            }

            let seq = await Modules.Messaging.repo.fetchConversationNextSeq(message!.cid);
            let res = await this.entities.ConversationEvent.create(message!.cid, seq, {
                kind: 'message_updated',
                mid: message!.id
            });

            await Modules.Messaging.AugmentationWorker.pushWork({ messageId: message.id });

            return res;
        });
    }

    async roomMembersCount(conversationId: number, status?: string): Promise<number> {
        return (await this.entities.RoomParticipant.allFromActive(conversationId)).filter(m => status === undefined || m.status === status).length;
    }

    async deleteMessage(messageId: number, uid: number): Promise<ConversationEvent> {
        return await inTx(async () => {
            let message = await this.entities.Message.findById(messageId);

            if (!message) {
                throw new Error('Message not found');
            }

            if (message.uid !== uid) {
                if (await Modules.Super.superRole(uid) !== 'super-admin') {
                    throw new AccessDeniedError();
                }
            }

            //
            // Delete message
            //

            message.deleted = true;

            //
            //  Update counters
            //

            let members = await Modules.Messaging.conv.findConversationMembers(message.cid);
            for (let member of members) {

                let existing = await Modules.Messaging.repo.getUserDialogState(member, message!.cid);
                let global = await Modules.Messaging.repo.getUserMessagingState(member);

                if (member !== uid) {
                    if (!existing.readMessageId || existing.readMessageId < message!.id) {
                        existing.unread--;
                        global.unread--;
                        global.seq++;

                        await this.entities.UserDialogEvent.create(member, global.seq, {
                            kind: 'message_read',
                            cid: message!.cid,
                            unread: existing.unread,
                            allUnread: global.unread
                        });
                    }
                }

                global.seq++;
                await this.entities.UserDialogEvent.create(member, global.seq, {
                    kind: 'message_deleted',
                    mid: message!.id
                });
            }

            let seq = await Modules.Messaging.repo.fetchConversationNextSeq(message!.cid);
            return await this.entities.ConversationEvent.create(message!.cid, seq, {
                kind: 'message_deleted',
                mid: message!.id
            });
        });
    }

    async setReaction(messageId: number, uid: number, reaction: string, reset: boolean = false) {
        return await inTx(async () => {
            let message = await this.entities.Message.findById(messageId);

            if (!message) {
                throw new Error('Message not found');
            }

            let reactions: { reaction: string, userId: number }[] = message.reactions ? [...message.reactions] as any : [];
            if (reactions.find(r => (r.userId === uid) && (r.reaction === reaction))) {
                if (reset) {
                    reactions = reactions.filter(r => !((r.userId === uid) && (r.reaction === reaction)));
                } else {
                    return;

                }
            } else {
                reactions.push({ userId: uid, reaction });
            }
            message.reactions = reactions;

            let members = await Modules.Messaging.conv.findConversationMembers(message.cid);
            for (let member of members) {
                let global = await Modules.Messaging.repo.getUserMessagingState(member);
                global.seq++;
                await this.entities.UserDialogEvent.create(member, global.seq, {
                    kind: 'message_updated',
                    mid: message!.id
                });
            }

            let seq = await Modules.Messaging.repo.fetchConversationNextSeq(message!.cid);
            return await this.entities.ConversationEvent.create(message!.cid, seq, {
                kind: 'message_updated',
                mid: message!.id
            });
        });
    }

    async addToChannel(channelId: number, uid: number) {
        let profile = await Modules.Users.profileById(uid);
        // no profile - user not signed up
        if (!profile) {
            return;
        }
        let firstName = profile!!.firstName;
        await inTx(async () => {
            let existing = await this.entities.RoomParticipant.findById(channelId, uid);
            if (existing) {
                if (existing.status === 'joined') {
                    return;
                } else {
                    existing.status = 'joined';
                }
            } else {
                await this.entities.RoomParticipant.create(channelId, uid, {
                    role: 'member',
                    status: 'joined',
                    invitedBy: uid
                }).then(async p => await p.flush());
            }
            await Modules.Messaging.sendMessage(
                channelId,
                uid,
                {
                    message: `${firstName} has joined the channel!`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'user_invite',
                        userIds: [uid],
                        invitedById: uid
                    }
                }
            );
        });
    }

    async fetchConversationNextSeq(cid: number) {
        return await inTx(async () => {
            let existing = await this.entities.ConversationSeq.findById(cid);
            let seq = 1;
            if (!existing) {
                await (await this.entities.ConversationSeq.create(cid, { seq: 1 })).flush();
            } else {
                seq = ++existing.seq;
                await existing.flush();
            }
            return seq;
        });
    }

    async findTopMessage(cid: number) {
        let res = await this.entities.Message.rangeFromChat(cid, 1, true);
        if (res.length === 0) {
            return null;
        } else {
            return res[0];
        }
    }

    async fetchNextMessageId() {
        return await inTx(async () => {
            let ex = await this.entities.Sequence.findById('message-id');
            if (ex) {
                let res = ++ex.value;
                await ex.flush();
                return res;
            } else {
                await this.entities.Sequence.create('message-id', { value: 1 });
                return 1;
            }
        });
    }

    // async updateUserUnreadCounter(uid: number, delta: number) {
    //     if (delta === 0) {
    //         return;
    //     }
    //     await inTx(async () => {
    //         let existing = await this.entities.UserMessagingState.findById(uid);
    //         if (!existing) {
    //             if (delta < 0) {
    //                 throw Error('Internal inconsistency');
    //             }
    //             await (await this.entities.UserMessagingState.create(uid, { unread: delta, seq: 1 })).flush();
    //         } else {
    //             if (existing.unread + delta < 0) {
    //                 throw Error('Internal inconsistency');
    //             }
    //             existing.unread += delta;
    //             await existing.flush();
    //         }
    //     });
    // }

    // async fetchUserNextSeq(uid: number) {
    //     return await inTx(async () => {
    //         let existing = await this.entities.UserMessagingState.findById(uid);
    //         if (!existing) {
    //             await (await this.entities.UserMessagingState.create(uid, { unread: 0, seq: 1 })).flush();
    //             return 1;
    //         } else {
    //             let res = ++existing.seq;
    //             await existing.flush();
    //             return res;
    //         }
    //     });
    // }

    async fetchUserUnread(uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserMessagingState.findById(uid);
            if (!existing) {
                await (await this.entities.UserMessagingState.create(uid, { unread: 0, seq: 0 })).flush();
                return 0;
            } else {
                return existing.unread;
            }
        });
    }

    async getUserNotificationState(uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserNotificationsState.findById(uid);
            if (!existing) {
                let created = await this.entities.UserNotificationsState.create(uid, {});
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }

    async getUserMessagingState(uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserMessagingState.findById(uid);
            if (!existing) {
                let created = await this.entities.UserMessagingState.create(uid, { seq: 0, unread: 0 });
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }

    async getUserDialogState(uid: number, cid: number) {
        return await inTx(async () => {
            let existing = await this.entities.UserDialog.findById(uid, cid);
            if (!existing) {
                let created = await this.entities.UserDialog.create(uid, cid, { unread: 0 });
                await created.flush();
                return created;
            } else {
                return existing;
            }
        });
    }
}