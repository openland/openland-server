import { Modules } from 'openland-modules/Modules';
import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { resolveSequenceNumber } from '../../openland-module-db/resolveSequenceNumber';

export class HubRepository {
    createPublicHub = async (parent: Context, uid: number, title: string, shortname: string) => {
        return await inTx(parent, async (ctx) => {
            let id = await resolveSequenceNumber(ctx, 'hub-id');

            // Create Hub
            let res = await Store.DiscussionHub.create(ctx, id, {
                description: {
                    type: 'public',
                    title
                }
            });
            // Assign shortname
            await Modules.Shortnames.setShortName(ctx, shortname, 'hub', id, uid);

            return res;
        });
    }

    createSystemHub = async (parent: Context, uid: number, title: string, shortname: string) => {
        return await inTx(parent, async (ctx) => {
            let id = await resolveSequenceNumber(ctx, 'hub-id');

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