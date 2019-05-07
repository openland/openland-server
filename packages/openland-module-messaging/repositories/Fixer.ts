import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { createLogger } from 'openland-log/createLogger';
import { Context } from 'openland-utils/Context';
import { injectable, inject } from 'inversify';

const logger = createLogger('fixer');

@injectable()
export class FixerRepository {
    private readonly entities: AllEntities;

    constructor(@inject('FDB') entities: AllEntities) {
        this.entities = entities;
    }

    async fixForUser(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            logger.debug(ctx, '[' + uid + '] fixing counters for #' + uid);
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
                let settings = await this.entities.UserDialogSettings.findById(ctx, uid, a.cid);
                let isMuted = (settings && settings.mute) || false;

                if (a.readMessageId) {
                    let total = Math.max(0, (await this.entities.Message.allFromChatAfter(ctx, a.cid, a.readMessageId)).filter((v) => v.uid !== uid).length - 1);
                    if (!isMuted) {
                        totalUnread += total;
                    }
                    logger.debug(ctx, '[' + uid + '] Fix counter in chat #' + a.cid + ', existing: ' + a.unread + ', updated: ' + total);
                    a.unread = total;
                } else {
                    let total = Math.max(0, (await this.entities.Message.allFromChat(ctx, a.cid)).filter((v) => v.uid !== uid).length);
                    if (!isMuted) {
                        totalUnread += total;
                    }
                    logger.debug(ctx, '[' + uid + '] fix counter in chat #' + a.cid + ', existing: ' + a.unread + ', updated: ' + total);
                    a.unread = total;
                }
            }
            let ex = await this.entities.UserMessagingState.findById(ctx, uid);
            if (ex) {
                logger.debug(ctx, '[' + uid + '] fix global counter existing: ' + ex.unread + ', updated: ' + totalUnread);
                ex.unread = totalUnread;
            } else {
                await this.entities.UserMessagingState.create(ctx, uid, { seq: 1, unread: totalUnread });
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