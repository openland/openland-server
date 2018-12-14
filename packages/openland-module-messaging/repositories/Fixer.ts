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
        await inTx(parent, async () => {
            logger.debug(parent, '[' + uid + '] fixing counters for #' + uid);
            let all = await this.entities.UserDialog.allFromUser(parent, uid);
            let totalUnread = 0;
            for (let a of all) {
                let conv = (await this.entities.Conversation.findById(parent, a.cid))!;
                if (conv.kind === 'room') {
                    let pat = await this.entities.RoomParticipant.findById(parent, a.cid, uid);
                    if (!pat || pat.status !== 'joined') {
                        a.unread = 0;
                        continue;
                    }
                }
                if (a.readMessageId) {
                    let total = Math.max(0, (await this.entities.Message.allFromChatAfter(parent, a.cid, a.readMessageId)).filter((v) => v.uid !== uid).length - 1);
                    totalUnread += total;
                    logger.debug(parent, '[' + uid + '] Fix counter in chat #' + a.cid + ', existing: ' + a.unread + ', updated: ' + total);
                    a.unread = total;
                } else {
                    let total = Math.max(0, (await this.entities.Message.allFromChat(parent, a.cid)).filter((v) => v.uid !== uid).length);
                    totalUnread += total;
                    logger.debug(parent, '[' + uid + '] fix counter in chat #' + a.cid + ', existing: ' + a.unread + ', updated: ' + total);
                    a.unread = total;
                }
            }
            let ex = await this.entities.UserMessagingState.findById(parent, uid);
            if (ex) {
                logger.debug(parent, '[' + uid + '] fix global counter existing: ' + ex.unread + ', updated: ' + totalUnread);
                ex.unread = totalUnread;
            } else {
                await this.entities.UserMessagingState.create(parent, uid, { seq: 1, unread: totalUnread });
            }
        });
    }
} 