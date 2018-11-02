import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';

export class FixerRepository {
    private readonly entities: AllEntities;
    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async fixForUser(uid: number) {
        await inTx(async () => {
            let all = await this.entities.UserDialog.allFromUser(uid);
            let totalUnread = 0;
            for (let a of all) {
                if (a.readMessageId) {
                    let total = Math.max(0, (await this.entities.Message.allFromChatAfter(a.cid, a.readMessageId)).filter((v) => v.uid !== uid).length - 1);
                    totalUnread += total;
                    a.unread = total;
                }
            }
            let ex = await this.entities.UserMessagingState.findById(uid);
            if (ex) {
                ex.unread = totalUnread;
            } else {
                await this.entities.UserMessagingState.create(uid, { seq: 1, unread: totalUnread });
            }
        });
    }
} 