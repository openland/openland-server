import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { randomGlobalInviteKey } from 'openland-server/utils/random';
import { DB } from 'openland-server/tables';

export class InviteRepository {
    private readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async getInviteLinkKey(uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.AppInviteLink.findFromUser(uid);
            if (existing) {
                return existing.id;
            }
            let res = await this.entities.AppInviteLink.create(randomGlobalInviteKey(), { uid });
            return res.id;
        });
    }

    async getLinkOwner(key: string) {
        return await inTx(async () => {
            let existing = await this.entities.AppInviteLink.findById(key);
            if (existing === null) {
                return null;
            }
            return DB.User.findById(existing.uid);
        });
    }
}