import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';

export class UserRepository {
    private entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async findProfilePrefill(uid: number) {
        return this.entities.UserProfilePrefil.findById(uid);
    }

    async saveProfilePrefill(uid: number, prefill: { firstName?: string, lastName?: string, picture?: string }) {
        await inTx(async () => {
            let existing = this.entities.UserProfilePrefil.findById(uid);
            if (!existing) {
                await this.entities.UserProfilePrefil.create(uid, {
                    firstName: prefill.firstName,
                    lastName: prefill.lastName,
                    picture: prefill.picture
                });
            }
        });
    }
}