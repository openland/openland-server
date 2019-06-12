import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Context } from '@openland/context';
import { injectable, inject } from 'inversify';
import { UserStateRepository } from './UserStateRepository';
import { createLogger } from '@openland/log';

const logger = createLogger('fixer');

@injectable()
export class FixerRepository {
    private readonly entities: AllEntities;
    private readonly userState: UserStateRepository;

    constructor(
        @inject('FDB') entities: AllEntities,
        @inject('UserStateRepository') userState: UserStateRepository
    ) {
        this.entities = entities;
        this.userState = userState;
    }

    async fixForUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            try {
                logger.debug(ctx, '[' + uid + '] fixing counters for #' + uid);
                let all = await this.entities.UserDialog.allFromUser(ctx, uid);
                let totalUnread = 0;
                for (let a of all) {
                    let conv = (await this.entities.Conversation.findById(ctx, a.cid))!;
                    let counter = this.entities.UserDialogCounter.byId(uid, a.cid);
                    if (!conv) {
                        counter.set(ctx, 0);
                        continue;
                    }
                    if (conv.kind === 'room') {
                        let pat = await this.entities.RoomParticipant.findById(ctx, a.cid, uid);
                        if (!pat || pat.status !== 'joined') {
                            counter.set(ctx, 0);
                            continue;
                        }
                    }

                    if (a.readMessageId) {
                        let total = Math.max(0, (await this.entities.Message.allFromChatAfter(ctx, a.cid, a.readMessageId)).filter((v) => v.uid !== uid).length);
                        totalUnread += total;
                        logger.debug(ctx, '[' + uid + '] Fix counter in chat #' + a.cid + ', existing: ' + (await counter.get(ctx) || 0) + ', updated: ' + total);
                        counter.set(ctx, total);
                    } else {
                        let total = Math.max(0, (await this.entities.Message.allFromChat(ctx, a.cid)).filter((v) => v.uid !== uid).length);
                        totalUnread += total;
                        logger.debug(ctx, '[' + uid + '] fix counter in chat #' + a.cid + ', existing: ' + (await counter.get(ctx) || 0) + ', updated: ' + total);
                        counter.set(ctx, total);
                    }
                }
                let globalCounter = this.entities.UserCounter.byId(uid);
                logger.debug(ctx, '[' + uid + '] fix global counter existing: ' + (await globalCounter.get(ctx) || 0) + ', updated: ' + totalUnread);
                globalCounter.set(ctx, totalUnread);

                return true;
            } catch (e) {
                logger.warn(ctx, 'counter_fix_error', e);
                return false;
            }
        });
    }

    async fixForAllUsers(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let users = await this.entities.User.findAll(ctx);

            for (let user of users) {
                await this.fixForUser(ctx, user.id);
            }

            return true;
        });
    }

    async deliverUserCounters(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let all = await this.entities.UserDialog.allFromUser(ctx, uid);
            //
            // Deliver new counters
            //
            for (let dialog of all) {
                let global = await this.userState.getUserMessagingState(ctx, uid);
                global.seq++;
                await global.flush(ctx);
                await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                    kind: 'message_read',
                    cid: dialog.cid,
                    unread: 0,
                    allUnread: 0
                });
            }
        });
    }
} 