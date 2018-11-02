import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { createLogger } from 'openland-log/createLogger';

const logger = createLogger('fixer');

export class FixerRepository {
    private readonly entities: AllEntities;
    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async fixForUser(uid: number) {
        await inTx(async () => {
            logger.debug('[' + uid + '] fixing counters for #' + uid);
            let all = await this.entities.UserDialog.allFromUser(uid);
            let totalUnread = 0;
            for (let a of all) {
                if (a.readMessageId) {
                    let total = Math.max(0, (await this.entities.Message.allFromChatAfter(a.cid, a.readMessageId)).filter((v) => v.uid !== uid).length - 1);
                    totalUnread += total;
                    logger.debug('[' + uid + '] Fix counter in chat #' + a.cid + ', existing: ' + a.unread + ', updated: ' + total);
                    a.unread = total;
                } else {
                    let total = Math.max(0, (await this.entities.Message.allFromChat(a.cid)).filter((v) => v.uid !== uid).length);
                    totalUnread += total;
                    logger.debug('[' + uid + '] fix counter in chat #' + a.cid + ', existing: ' + a.unread + ', updated: ' + total);
                    a.unread = total;
                }
            }
            let ex = await this.entities.UserMessagingState.findById(uid);
            if (ex) {
                logger.debug('[' + uid + '] fix global counter existing: ' + ex.unread + ', updated: ' + totalUnread);
                ex.unread = totalUnread;
            } else {
                await this.entities.UserMessagingState.create(uid, { seq: 1, unread: totalUnread });
            }
        });
    }
} 