import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer2';

export function invitesIndexer() {
    declareSearchIndexer('invites-room-index', 3, 'invites-room', Store.ChannelInvitation.updated.stream({ batchSize: 50 }))
        .withProperties({
            uid: {
                type: 'long'
            },
            name: {
                type: 'text'
            },
            createdAt: {
                type: 'date'
            },
            updatedAt: {
                type: 'date'
            }
        })
        .start(async (item, parent) => {
            let user = await inTx(parent, async (ctx) => await Store.UserProfile.findById(ctx, item.creatorId));

            return {
                id: item.id!!,
                doc: {
                    uid: item.creatorId,
                    name: user ? ((user.firstName || '') + ' ' + (user.lastName || '')) : 'unknown',
                    createdAt: (item as any).createdAt,
                    updatedAt: (item as any).updatedAt,
                }
            };
        });
}