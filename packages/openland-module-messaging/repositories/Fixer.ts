import { inTx } from '@openland/foundationdb';
import { Context, createNamedContext } from '@openland/context';
import { injectable } from 'inversify';
import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';
import { UserDialogMessageReadEvent } from '../../openland-module-db/store';

const logger = createLogger('fixer');
const rootCtx = createNamedContext('fixer');

@injectable()
export class FixerRepository {
    async fixForUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            try {
                logger.debug(ctx, '[' + uid + '] fixing counters for #' + uid);
                let all = await Modules.Messaging.findUserDialogs(ctx, uid);
                let totalUnread = 0;
                for (let a of all) {
                    let conv = (await Store.Conversation.findById(ctx, a.cid))!;
                    let counter = Store.UserDialogCounter.byId(uid, a.cid);
                    if (!conv) {
                        counter.set(ctx, 0);
                        continue;
                    }
                    if (conv.kind === 'room') {
                        let pat = await Store.RoomParticipant.findById(ctx, a.cid, uid);
                        if (!pat || pat.status !== 'joined') {
                            counter.set(ctx, 0);
                            continue;
                        }
                    }

                    let readMessageId = await Store.UserDialogReadMessageId.get(ctx, uid, a.cid);
                    if (readMessageId !== 0) {
                        let total = Math.max(0, (await Store.Message.chat.query(ctx, a.cid, {after: readMessageId})).items.filter((v) => v.uid !== uid).length);
                        totalUnread += total;
                        logger.debug(ctx, '[' + uid + '] Fix counter in chat #' + a.cid + ', existing: ' + (await counter.get(ctx) || 0) + ', updated: ' + total);
                        counter.set(ctx, total);
                    } else {
                        let total = Math.max(0, (await Store.Message.chat.findAll(ctx, a.cid)).filter((v) => v.uid !== uid).length);
                        totalUnread += total;
                        logger.debug(ctx, '[' + uid + '] fix counter in chat #' + a.cid + ', existing: ' + (await counter.get(ctx) || 0) + ', updated: ' + total);
                        counter.set(ctx, total);
                    }
                }
                let globalCounter = Store.UserCounter.byId(uid);
                logger.debug(ctx, '[' + uid + '] fix global counter existing: ' + (await globalCounter.get(ctx) || 0) + ', updated: ' + totalUnread);
                globalCounter.set(ctx, totalUnread);

                return true;
            } catch (e) {
                logger.warn(ctx, 'counter_fix_error', e);
                return false;
            }
        });
    }

    async fixForUserModern(uid: number) {
        const fixForDialog = async (parent: Context, cid: number) => {
            return inTx(parent, async ctx => {
                let conv = (await Store.Conversation.findById(ctx, cid))!;
                let counter = Store.UserDialogCounter.byId(uid, cid);
                if (!conv) {
                    counter.set(ctx, 0);
                    return;
                }
                if (conv.kind === 'room') {
                    let pat = await Store.RoomParticipant.findById(ctx, cid, uid);
                    if (!pat || pat.status !== 'joined') {
                        counter.set(ctx, 0);
                        return;
                    }
                }
                let readMessageId = await Store.UserDialogReadMessageId.get(ctx, uid, cid);
                if (readMessageId !== 0) {
                    let total = Math.max(0, (await Store.Message.chat.query(ctx, cid, {after: readMessageId, limit: 10000})).items.filter((v) => v.uid !== uid).length);
                    logger.debug(ctx, '[' + uid + '] Fix counter in chat #' + cid + ', existing: ' + (await counter.get(ctx) || 0) + ', updated: ' + total);
                    counter.set(ctx, total);
                } else {
                    let total = Math.max(0, (await Store.Message.chat.query(ctx, cid, { limit: 10000 })).items.filter((v) => v.uid !== uid).length);
                    logger.debug(ctx, '[' + uid + '] fix counter in chat #' + cid + ', existing: ' + (await counter.get(ctx) || 0) + ', updated: ' + total);
                    counter.set(ctx, total);
                }
            });
        };

        try {
            logger.debug(rootCtx, '[' + uid + '] fixing counters for #' + uid);
            let dialogs = await inTx(rootCtx, async ctx => await Modules.Messaging.findUserDialogs(ctx, uid));
            await Promise.all(dialogs.map(c => fixForDialog(rootCtx, c.cid)));
            return true;
        } catch (e) {
            logger.warn(rootCtx, 'counter_fix_error', e);
            return false;
        }
    }

    async fixForAllUsers(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let users = await Store.User.findAll(ctx);

            for (let user of users) {
                await this.fixForUser(ctx, user.id);
            }

            return true;
        });
    }

    async deliverUserCounters(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let all = await Modules.Messaging.findUserDialogs(ctx, uid);
            //
            // Deliver new counters
            //
            for (let dialog of all) {
                Store.UserDialogEventStore.post(ctx, uid, UserDialogMessageReadEvent.create({
                    uid,
                    cid: dialog.cid,
                }));
            }
        });
    }
} 