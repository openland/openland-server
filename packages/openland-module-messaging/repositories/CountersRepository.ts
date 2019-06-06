import { inTx } from 'foundation-orm/inTx';
import { AllEntities, Message } from 'openland-module-db/schema';
import { injectable } from 'inversify';
import { UserStateRepository } from './UserStateRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from '@openland/context';
import { hasMention } from '../resolvers/ModernMessage.resolver';

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

            // Updating counters if not read already
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            let localCounter = this.entities.UserDialogCounter.byId(uid, message.cid);
            let globalCounter = this.entities.UserCounter.byId(uid);

            if (!local.readMessageId || message.id > local.readMessageId) {

                // Mark dialog as having mention
                let setMention = false;
                if (!local.haveMention && !message.isService && hasMention(message, uid)) {
                    local.haveMention = true;
                    setMention = true;
                }

                // Update Counters
                localCounter.increment(ctx);
                if (!local.disableGlobalCounter) {
                    globalCounter.increment(ctx);
                }

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
            let localCounter = this.entities.UserDialogCounter.byId(uid, message.cid);
            // let global = await this.userState.getUserMessagingState(ctx, uid);
            let globalCounter = this.entities.UserCounter.byId(uid);
            if (message.uid !== uid && (!local.readMessageId || mid > local.readMessageId)) {
                localCounter.decrement(ctx);
                if (!local.disableGlobalCounter) {
                    globalCounter.decrement(ctx);
                }

                // TODO: Optimize
                if (local.haveMention) {
                    let mentionReset = true;
                    let remaining = (await this.entities.Message.allFromChatAfter(ctx, message.cid, mid)).filter((v) => v.uid !== uid && v.id !== mid);
                    for (let m of remaining) {
                        if (hasMention(m, uid)) {
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
            let localCounter = this.entities.UserDialogCounter.byId(uid, message.cid);
            let prevReadMessageId = local.readMessageId;
            // let global = await this.userState.getUserMessagingState(ctx, uid);
            let globalCounter = this.entities.UserCounter.byId(uid);
            if (!local.readMessageId || local.readMessageId < mid) {
                local.readMessageId = mid;

                // Find all remaining messages
                // TODO: Optimize (remove query)
                let remaining = (await this.entities.Message.allFromChatAfter(ctx, message.cid, mid)).filter((v) => v.uid !== uid && v.id !== mid);
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
                    if (!local.disableGlobalCounter) {
                        globalCounter.add(ctx, delta);
                    }
                }

                let mentionReset = false;
                if (prevReadMessageId && local.haveMention) {
                    mentionReset = true;
                    for (let m of remaining) {
                        if (hasMention(m, uid)) {
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
            let localCounter = this.entities.UserDialogCounter.byId(uid, cid);
            let globalCounter = this.entities.UserCounter.byId(uid);
            let localUnread = (await localCounter.get(ctx) || 0);
            if (localUnread > 0) {
                if (!local.disableGlobalCounter) {
                    globalCounter.add(ctx, -localUnread);
                }
                localCounter.set(ctx, 0);
                local.haveMention = false;
                return -localUnread;
            }
            return 0;
        });
    }
}