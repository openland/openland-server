import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { createLogger } from 'openland-log/createLogger';
import { Context } from 'openland-utils/Context';
import { injectable, inject } from 'inversify';
import { UserStateRepository } from './UserStateRepository';

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
            logger.debug(ctx, '[' + uid + '] fixing counters for #' + uid);
            let processedIds: number[] = [];
            let all = await this.entities.UserDialog.allFromUser(ctx, uid);
            let totalUnread = 0;
            for (let a of all) {
                let conv = (await this.entities.Conversation.findById(ctx, a.cid))!;
                if (!conv) {
                    a.unread = 0;
                    continue;
                }
                if (conv.kind === 'room') {
                    let pat = await this.entities.RoomParticipant.findById(ctx, a.cid, uid);
                    if (!pat || pat.status !== 'joined') {
                        a.unread = 0;
                        continue;
                    }
                }

                if (a.readMessageId) {
                    let total = Math.max(0, (await this.entities.Message.allFromChatAfter(ctx, a.cid, a.readMessageId)).filter((v) => v.uid !== uid).length);
                    totalUnread += total;
                    logger.debug(ctx, '[' + uid + '] Fix counter in chat #' + a.cid + ', existing: ' + a.unread + ', updated: ' + total);
                    a.unread = total;
                } else {
                    let total = Math.max(0, (await this.entities.Message.allFromChat(ctx, a.cid)).filter((v) => v.uid !== uid).length);
                    totalUnread += total;
                    logger.debug(ctx, '[' + uid + '] fix counter in chat #' + a.cid + ', existing: ' + a.unread + ', updated: ' + total);
                    a.unread = total;
                }

                processedIds.push(a.cid);
            }
            let ex = await this.entities.UserMessagingState.findById(ctx, uid);
            if (ex) {
                logger.debug(ctx, '[' + uid + '] fix global counter existing: ' + ex.unread + ', updated: ' + totalUnread);
                ex.unread = totalUnread;
            } else {
                await this.entities.UserMessagingState.create(ctx, uid, { seq: 1, unread: totalUnread });
            }

            //
            // Deliver new counters
            //
            for (let cid of processedIds) {
                let global = await this.userState.getUserMessagingState(ctx, uid);
                let local = await this.userState.getUserDialogState(ctx, uid, cid);
                global.seq++;
                await global.flush();
                await this.entities.UserDialogEvent.create(ctx, uid, global.seq, {
                    kind: 'message_read',
                    cid: cid,
                    unread: local.unread,
                    allUnread: global.unread
                });
            }
            return true;
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
} 