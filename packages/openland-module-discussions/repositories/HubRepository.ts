import { Modules } from 'openland-modules/Modules';
import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';

export class HubRepository {
    createSystemHub = async (title: string, shortname: string, uid: number, parent: Context) => {
        return await inTx(parent, async (ctx) => {

            let seq = (await Store.Sequence.findById(ctx, 'hub-id'));
            if (!seq) {
                seq = await Store.Sequence.create(ctx, 'hub-id', { value: 0 });
            }
            let id = ++seq.value;
            await seq.flush(ctx);

            // Create Hub
            let res = await Store.DiscussionHub.create(ctx, id, {
                description: {
                    type: 'system',
                    title
                }
            });
            // Assign shortname
            await Modules.Shortnames.setShortName(ctx, shortname, 'hub', id, uid);
            
            return res;
        });
    }
}