import { inTx } from '@openland/foundationdb';
import { AllEntities, Message } from 'openland-module-db/schema';
import { injectable } from 'inversify';
import { UserStateRepository } from './UserStateRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from '@openland/context';
import { MessageMention } from '../MessageInput';

function hasMention(message: Message, uid: number) {
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
                return { delta: 0 };
            }

            // Ignore own messages
            if (message.uid === uid) {
                return { delta: 0 };
            }

            // Updating counters if not read already
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            let localHasMention = this.entities.UserDialogHaveMention.byId(uid, message.cid);
            let localCounter = this.entities.UserDialogCounter.byId(uid, message.cid);
            let globalCounter = this.entities.UserCounter.byId(uid);

            if (!local.readMessageId || message.id > local.readMessageId) {

                // Mark dialog as having mention
                if (!message.isService && hasMention(message, uid)) {
                    localHasMention.set(ctx, true);
                }

                // Update Counters
                localCounter.increment(ctx);
                globalCounter.increment(ctx);

                return { delta: 1 };
            }

            return { delta: 0 };
        });
    }

    onMessageDeleted = async (parent: Context, uid: number, message: Message) => {
        return await inTx(parent, async (ctx) => {
            // Updating counters if not read already
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            let localCounter = this.entities.UserDialogCounter.byId(uid, message.cid);
            let globalCounter = this.entities.UserCounter.byId(uid);

            if (message.uid !== uid && (!local.readMessageId || message.id > local.readMessageId)) {
                localCounter.decrement(ctx);
                globalCounter.decrement(ctx);

                // Reset mention flag if needed
                // TODO: Replace with counters
                let haveMention = this.entities.UserDialogHaveMention.byId(uid, message.cid);
                if (await haveMention.get(ctx)) {
                    let mentionReset = true;
                    let remaining = (await this.entities.Message.allFromChatAfter(ctx, message.cid, message.id)).filter((v) => v.uid !== uid && v.id !== message.id);
                    for (let m of remaining) {
                        if (hasMention(m, uid)) {
                            mentionReset = false;
                            break;
                        }
                    }
                    if (mentionReset) {
                        haveMention.set(ctx, false);
                    }
                }
                return -1;
            }
            return 0;
        });
    }

    onMessageRead = async (parent: Context, uid: number, message: Message) => {
        return await inTx(parent, async (ctx) => {
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            let localCounter = this.entities.UserDialogCounter.byId(uid, message.cid);
            let haveMention = this.entities.UserDialogHaveMention.byId(uid, message.cid);
            let prevReadMessageId = local.readMessageId;
            let globalCounter = this.entities.UserCounter.byId(uid);
            if (!local.readMessageId || local.readMessageId < message.id) {
                local.readMessageId = message.id;

                // Find all remaining messages
                // TODO: Optimize (remove query)
                let remaining = (await this.entities.Message.allFromChatAfter(ctx, message.cid, message.id)).filter((v) => v.uid !== uid && v.id !== message.id);
                let remainingCount = remaining.length;
                let delta: number;
                let localUnread = await this.entities.UserDialogCounter.byId(uid, message.cid).get(ctx);
                if (remainingCount === 0) { // Just additional case for self-healing of a broken counters
                    delta = -localUnread;
                } else {
                    delta = - (localUnread - remainingCount);
                }
                // Crazy hack to avoid -0 values
                if (delta === 0) {
                    delta = 0;
                }

                // Update counters
                if (delta !== 0) {
                    localCounter.add(ctx, delta);
                    globalCounter.add(ctx, delta);
                }

                let mentionReset = false;
                if (prevReadMessageId && (await haveMention.get(ctx))) {
                    mentionReset = true;
                    for (let m of remaining) {
                        if (hasMention(m, uid)) {
                            mentionReset = false;
                            break;
                        }
                    }

                    if (mentionReset) {
                        await haveMention.set(ctx, false);
                    }
                }

                return { delta: delta, mentionReset: mentionReset };
            }
            return { delta: 0, mentionReset: false };
        });
    }

    onDialogDeleted = async (parent: Context, uid: number, cid: number) => {
        return await inTx(parent, async (ctx) => {
            let haveMention = this.entities.UserDialogHaveMention.byId(uid, cid);
            let localCounter = this.entities.UserDialogCounter.byId(uid, cid);
            let globalCounter = this.entities.UserCounter.byId(uid);
            let localUnread = (await localCounter.get(ctx) || 0);
            if (localUnread > 0) {
                globalCounter.add(ctx, -localUnread);
                localCounter.set(ctx, 0);
                haveMention.set(ctx, false);
                return -localUnread;
            }
            return 0;
        });
    }
}