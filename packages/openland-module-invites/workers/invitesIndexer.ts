import { FDB } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { EmptyContext } from '@openland/context';

export function invitesIndexer() {
    declareSearchIndexer('invites-room-index', 3, 'invites-room', FDB.ChannelInvitation.createUpdatedStream(EmptyContext, 50))
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
        .start(async (item) => {
            let ctx = EmptyContext;
            let user = await FDB.UserProfile.findById(ctx, item.creatorId);

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