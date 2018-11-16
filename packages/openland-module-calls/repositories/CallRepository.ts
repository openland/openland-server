import { injectable, inject } from 'inversify';
import { AllEntities } from 'openland-module-db/schema';
import { Context } from 'openland-utils/Context';
import { inTx } from 'foundation-orm/inTx';

@injectable()
export class CallRepository {

    @inject('FDB')
    entities!: AllEntities;

    findConference = async (parent: Context, id: number) => {
        return await inTx(parent, async (ctx) => {
            let res = await this.entities.ConferenceRoom.findById(ctx, id);
            if (!res) {
                res = await this.entities.ConferenceRoom.create(ctx, id, {});
            }
            return res;
        });
    }
}