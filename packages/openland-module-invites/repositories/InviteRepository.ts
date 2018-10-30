import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { randomGlobalInviteKey } from 'openland-server/utils/random';

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

    async getInvteLinkData(key: string) {
        return this.entities.AppInviteLink.findById(key);
    }
}