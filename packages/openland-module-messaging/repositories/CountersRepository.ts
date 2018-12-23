import { inTx } from 'foundation-orm/inTx';
import { AllEntities } from 'openland-module-db/schema';
import { injectable } from 'inversify';
import { UserStateRepository } from './UserStateRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from 'openland-utils/Context';
import { MessageMention } from '../MessageInput';

@injectable()
export class CountersRepository {

    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('UserStateRepository')
    private readonly userState!: UserStateRepository;

    onMessageReceived = async (parent: Context, uid: number, mid: number) => {
        return await inTx(parent, async (ctx) => {
            let message = (await this.entities.Message.findById(ctx, mid));
            if (!message) {
                throw Error('Unable to find message');
            }

            // Ignore already deleted messages
            if (message.deleted) {
                return 0;
            }

            // Ignore own messages
            if (message.uid === uid) {
                return 0;
            }

            // Avoid double counter for same message
            if (await this.entities.UserDialogHandledMessage.findById(ctx, uid, message.cid, mid)) {
                return 0;
            }
            await this.entities.UserDialogHandledMessage.create(ctx, uid, message.cid, mid, {});

            // Updating counters if not read already
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            let global = await this.userState.getUserMessagingState(ctx, uid);
            if (!local.readMessageId || mid > local.readMessageId) {
                local.unread++;
                global.unread++;
                await global.flush();
                await local.flush();
                return 1;
            }
            return 0;
        });
    }

    onMessageDeleted = async (parent: Context, uid: number, mid: number) => {
        return await inTx(parent, async (ctx) => {
            let message = (await this.entities.Message.findById(ctx, mid));
            if (!message) {
                throw Error('Unable to find message');
            }

            // Updating counters if not read already
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            let global = await this.userState.getUserMessagingState(ctx, uid);
            if (message.uid !== uid && (!local.readMessageId || mid > local.readMessageId)) {
                local.unread--;
                global.unread--;
                await global.flush();
                await local.flush();
                return -1;
            }
            return 0;
        });
    }

    onMessageRead = async (parent: Context, uid: number, mid: number) => {
        return await inTx(parent, async (ctx) => {
            let message = (await this.entities.Message.findById(ctx, mid));
            if (!message) {
                throw Error('Unable to find message');
            }
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            let prevReadMessageId = local.readMessageId;
            let global = await this.userState.getUserMessagingState(ctx, uid);
            if (!local.readMessageId || local.readMessageId < mid) {
                local.readMessageId = mid;

                // Find all remaining messages
                let remaining = (await this.entities.Message.allFromChatAfter(ctx, message.cid, mid)).filter((v) => v.uid !== uid && v.id !== mid).length;
                let delta: number;
                if (remaining === 0) { // Just additional case for self-healing of a broken counters
                    delta = -local.unread;
                } else {
                    delta = - (remaining - local.unread);
                }
                // Crazy hack to avoid -0 values
                if (delta === 0) {
                    delta = 0;
                }

                // Update counters
                if (delta !== 0) {
                    local.unread += delta;
                    global.unread += delta;
                }

                await global.flush();
                await local.flush();

                let mentionReset = false;
                if (prevReadMessageId && local.haveMention) {
                    let readMessages = (await this.entities.Message.allFromChatAfter(ctx, message.cid, prevReadMessageId)).filter((v) => v.uid !== uid && v.id !== prevReadMessageId && v.id <= mid);
                    for (let readMessage of readMessages) {
                        if (readMessage.mentions && readMessage.mentions.indexOf(uid) > -1) {
                            mentionReset = true;
                        } else if (readMessage.complexMentions && readMessage.complexMentions.find((m: MessageMention) => m.type === 'User' && m.id === uid)) {
                            mentionReset = true;
                        }
                    }

                    if (mentionReset) {
                        local.haveMention = false;
                        // await Modules.Messaging.room.onDialogMentionedChanged(ctx, uid, message.cid, false);
                    }
                }

                return { delta: delta, mentionReset: mentionReset };
            }
            return { delta: 0, mentionReset: false };
        });
    }

    onDialogDeleted = async (parent: Context, uid: number, cid: number) => {
        return await inTx(parent, async (ctx) => {
            let local = await this.userState.getUserDialogState(ctx, uid, cid);
            let global = await this.userState.getUserMessagingState(ctx, uid);
            if (local.unread > 0) {
                let delta = -local.unread;
                global.unread += delta;
                local.unread = 0;
                await global.flush();
                await local.flush();
                return delta;
            }
            return 0;
        });
    }
}