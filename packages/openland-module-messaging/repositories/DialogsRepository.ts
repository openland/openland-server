import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';

export class DialogsRepository {
    readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async getConversationSettings(uid: number, cid: number) {
        return await inTx(async () => {
            let res = await this.entities.UserDialogSettings.findById(uid, cid);
            if (res) {
                return res;
            }
            return await this.entities.UserDialogSettings.create(uid, cid, { mute: false });
        });
    }
}