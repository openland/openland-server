import { uuid } from 'openland-utils/uuid';
import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';

export class HubRepository {
    createSystemHub = async (title: string, parent: Context) => {
        return await inTx(parent, async (ctx) => {
            return await Store.DiscussionHub.create(ctx, uuid(), {
                description: {
                    type: 'system',
                    title
                }
            });
        });
    }
}