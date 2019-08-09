import { encoders, inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { UserStateRepository } from './UserStateRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from '@openland/context';
import { hasMention } from '../resolvers/ModernMessage.resolver';
// import { CounterStrategyAll } from './CounterStrategies';
import { Store } from 'openland-module-db/FDB';
import { Message } from 'openland-module-db/store';
import { createLogger } from '@openland/log';

const logger = createLogger('counters');

@injectable()
export class CountersRepository {

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
            let localHasMention = Store.UserDialogHaveMention.byId(uid, message.cid);
            let localCounter = Store.UserDialogCounter.byId(uid, message.cid);
            let globalCounter = Store.UserCounter.byId(uid);

            if (!local.readMessageId || message.id > local.readMessageId) {

                // Mark dialog as having mention
                if (!message.isService && hasMention(message, uid)) {
                    localHasMention.set(ctx, true);
                }

                // Update Counters
                localCounter.increment(ctx);
                globalCounter.increment(ctx);
                await this.incrementCounter(ctx, uid, message.cid);

                // let unreadPromise = localCounter.get(ctx);
                // let isMutedPromise = this.isChatMuted(ctx, uid, message.cid);
                // let unread = await unreadPromise;
                // let isMuted = await isMutedPromise;
                // CounterStrategyAll.inContext(ctx, uid, message.cid, unread, isMuted).onMessageReceived();

                return { delta: 1 };
            }

            return { delta: 0 };
        });
    }

    onMessageDeleted = async (parent: Context, uid: number, message: Message) => {
        return await inTx(parent, async (ctx) => {
            // Updating counters if not read already
            let local = await this.userState.getUserDialogState(ctx, uid, message.cid);
            let localCounter = Store.UserDialogCounter.byId(uid, message.cid);
            let globalCounter = Store.UserCounter.byId(uid);

            if (message.uid !== uid && (!local.readMessageId || message.id > local.readMessageId)) {
                localCounter.decrement(ctx);
                globalCounter.decrement(ctx);
                await this.decrementCounter(ctx, uid, message.cid, -1);

                // let unread = await localCounter.get(ctx);
                // let isMuted = await this.isChatMuted(ctx, uid, message.cid);
                // CounterStrategyAll.inContext(ctx, uid, message.cid, unread, isMuted).onMessageDeleted();

                // Reset mention flag if needed
                // TODO: Replace with counters
                let haveMention = Store.UserDialogHaveMention.byId(uid, message.cid);
                if (await haveMention.get(ctx)) {
                    let mentionReset = true;
                    let remaining = (await Store.Message.chat.query(ctx, message.cid, { after: message.id })).items.filter((v) => v.uid !== uid && v.id !== message.id);
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
            let localCounter = Store.UserDialogCounter.byId(uid, message.cid);
            let haveMention = Store.UserDialogHaveMention.byId(uid, message.cid);
            let prevReadMessageId = local.readMessageId;
            let globalCounter = Store.UserCounter.byId(uid);
            if (!local.readMessageId || local.readMessageId < message.id) {
                local.readMessageId = message.id;

                // Find all remaining messages
                // TODO: Optimize (remove query)
                let remaining = (await Store.Message.chat.query(ctx, message.cid, { after: message.id })).items.filter((v) => v.uid !== uid && v.id !== message.id);
                let remainingCount = remaining.length;
                let delta: number;
                let localUnread = await Store.UserDialogCounter.byId(uid, message.cid).get(ctx);
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
                    if (delta > 0) {
                        logger.log(ctx, `onMessageRead positive delta, uid: ${uid}, delta: ${delta}, localUnread: ${localUnread}, remainingCount: ${remainingCount}, messageId: ${message.id}, readMessageId: ${prevReadMessageId}`);
                        return { delta: 0, mentionReset: false };
                    }
                    localCounter.add(ctx, delta);
                    globalCounter.add(ctx, delta);
                    await this.decrementCounter(ctx, uid, message.cid, delta);

                    // let unread = await localCounter.get(ctx);
                    // let isMuted = await this.isChatMuted(ctx, uid, message.cid);
                    // CounterStrategyAll.inContext(ctx, uid, message.cid, unread, isMuted).onMessageRead(-delta);
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
            let haveMention = Store.UserDialogHaveMention.byId(uid, cid);
            let localCounter = Store.UserDialogCounter.byId(uid, cid);
            let globalCounter = Store.UserCounter.byId(uid);
            let localUnread = (await localCounter.get(ctx) || 0);
            if (localUnread > 0) {
                globalCounter.add(ctx, -localUnread);
                // let unread = await localCounter.get(ctx);
                let isMuted = await this.isChatMuted(ctx, uid, cid);
                // CounterStrategyAll.inContext(ctx, uid, cid, unread, isMuted).onChatDeleted();
                localCounter.set(ctx, 0);
                haveMention.set(ctx, false);

                let directory = Store.UserCountersIndexDirectory
                    .withKeyEncoding(encoders.tuple)
                    .withValueEncoding(encoders.int32LE);
                directory.clear(ctx, [uid, isMuted ? 'muted' : 'unmuted', cid]);

                return -localUnread;
            }
            return 0;
        });
    }

    onDialogMuteChange = async (parent: Context, uid: number, cid: number) => {
        return await inTx(parent, async (ctx) => {
            // let unread = await Store.UserDialogCounter.byId(uid, cid).get(ctx);
            let isMuted = await this.isChatMuted(ctx, uid, cid);
            // CounterStrategyAll.inContext(ctx, uid, cid, unread, isMuted).onMuteChange();

            let directory = Store.UserCountersIndexDirectory
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.int32LE);
            let value = await directory.get(ctx, [uid, !isMuted ? 'muted' : 'unmuted', cid]);
            if (value) {
                directory.clear(ctx, [uid, !isMuted ? 'muted' : 'unmuted', cid]);
                directory.set(ctx, [uid, isMuted ? 'muted' : 'unmuted', cid], value);
            }

            return 0;
        });
    }

    private incrementCounter = async (parent: Context, uid: number, cid: number) => {
        return await inTx(parent, async (ctx) => {
            let isMuted = await this.isChatMuted(ctx, uid, cid);

            Store.UserCountersIndexDirectory
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.int32LE)
                .add(ctx, [uid, isMuted ? 'muted' : 'unmuted', cid], 1);
        });
    }

    private decrementCounter = async (parent: Context, uid: number, cid: number, by: number) => {
        return await inTx(parent, async (ctx) => {
            let isMuted = await this.isChatMuted(ctx, uid, cid);
            let directory = Store.UserCountersIndexDirectory
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.int32LE);

            directory.add(ctx, [uid, isMuted ? 'muted' : 'unmuted', cid], by);
            let value = await directory.get(ctx, [uid, isMuted ? 'muted' : 'unmuted', cid]);
            if (value === 0) {
                directory.clear(ctx, [uid, isMuted ? 'muted' : 'unmuted', cid]);
            }
        });
    }

    private isChatMuted = async (ctx: Context, uid: number, cid: number) => {
        let settings = await Store.UserDialogSettings.findById(ctx, uid, cid);
        if (settings && settings.mute) {
            return true;
        }
        return false;
    }
}