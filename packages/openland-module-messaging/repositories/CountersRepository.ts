import { inTx } from 'foundation-orm/inTx';
import { AllEntities, Message } from 'openland-module-db/schema';
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

    onMessageReceived = async (parent: Context, uid: number, message: Message) => {
        return await inTx(parent, async (ctx) => {
            // Ignore already deleted messages
            if (message.deleted) {
                return { delta: 0, setMention: false };
            }

            // Ignore own messages
            if (message.uid === uid) {
                return { delta: 0, setMention: false };
            }

            // Avoid double counter for same message
            // if (await this.entities.UserDialogHandledMessage.findById(ctx, uid, message.cid, message.id)) {
            //     return { delta: 0, setMention: false };
            // }
            // await this.entities.UserDialogHandledMessage.create(ctx, uid, message.cid, message.id, {});

            // Updating counters if not read already
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            let global = await this.userState.getUserMessagingState(ctx, uid);
            if (!local.readMessageId || message.id > local.readMessageId) {

                // Mark dialog as having mention
                let setMention = false;
                if (!local.haveMention && !message.isService && this.hasMention(message, uid)) {
                    local.haveMention = true;
                    setMention = true;
                }

                // Update Counters
                local.unread++;
                global.unread++;

                return { delta: 1, setMention };
            }
            return { delta: 0, setMention: false };
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

                // TODO: Optimize
                if (local.haveMention) {
                    let mentionReset = true;
                    let remaining = (await this.entities.Message.allFromChatAfter(ctx, message.cid, mid)).filter((v) => v.uid !== uid && v.id !== mid);
                    for (let m of remaining) {
                        if (this.hasMention(m, uid)) {
                            mentionReset = false;
                            break;
                        }
                    }
                    if (mentionReset) {
                        local.haveMention = false;
                    }
                }
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
                // TODO: Optimize (remove query)
                let remaining = (await this.entities.Message.allFromChatAfter(ctx, message.cid, mid)).filter((v) => v.uid !== uid && v.id !== mid);
                let remainingCount = remaining.length;
                let delta: number;
                if (remainingCount === 0) { // Just additional case for self-healing of a broken counters
                    delta = -local.unread;
                } else {
                    delta = - (local.unread - remainingCount);
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

                let mentionReset = false;
                if (prevReadMessageId && local.haveMention) {
                    mentionReset = true;
                    for (let m of remaining) {
                        if (this.hasMention(m, uid)) {
                            mentionReset = false;
                            break;
                        }
                    }

                    if (mentionReset) {
                        local.haveMention = false;
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
                local.haveMention = false;
                return delta;
            }
            return 0;
        });
    }

    onDialogMuteChange = async (parent: Context, uid: number, cid: number, mute: boolean) => {
        return await inTx(parent, async (ctx) => {
            let local = await this.userState.getUserDialogState(ctx, uid, cid);
            let global = await this.userState.getUserMessagingState(ctx, uid);

            let isMuted = (await this.userState.getRoomSettings(ctx, uid, cid)).mute;

            if (isMuted && !mute) {
                global.unread += local.unread;
                return local.unread;
            } else if (!isMuted && mute) {
                global.unread -= local.unread;
                return -local.unread;
            }
            return 0;
        });
    }

    private hasMention(message: Message, uid: number) {
        if (message.spans && message.spans.find(s => (s.type === 'user_mention' && s.user === uid) || (s.type === 'multi_user_mention' && s.users.indexOf(uid) > -1))) {
            return true;
        } else if (message.spans && message.spans.find(s => s.type === 'all_mention')) {
            return true;
        } else if (message.mentions && message.mentions.indexOf(uid) > -1) {
            return true;
        } else if (message.complexMentions && message.complexMentions.find((m: MessageMention) => m.type === 'User' && m.id === uid)) {
            return true;
        }
        return false;
    }
}