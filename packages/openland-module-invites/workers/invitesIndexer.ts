import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';

export function invitesIndexer() {
    declareSearchIndexer({
        name: 'invites-room-index',
        version: 4,
        index: 'invites-room',
        stream: Store.ChannelInvitation.updated.stream({ batchSize: 50 })
    }).withProperties({
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
    }).start(async (args, parent) => {
        let user = await inTx(parent, async (ctx) => await Store.UserProfile.findById(ctx, args.item.creatorId));

        return {
            id: args.item.id!!,
            doc: {
                uid: args.item.creatorId,
                name: user ? ((user.firstName || '') + ' ' + (user.lastName || '')) : 'unknown',
                createdAt: (args.item as any).createdAt,
                updatedAt: (args.item as any).updatedAt,
            }
        };
    });
}