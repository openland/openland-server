import { FDB } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { createEmptyContext } from 'openland-utils/Context';

export function invitesIndexer() {
    declareSearchIndexer('invites-room-index', 2, 'invites-room', FDB.ChannelInvitation.createUpdatedStream(createEmptyContext(), 50))
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
            let ctx = createEmptyContext();
            let user = await FDB.UserProfile.findById(ctx, item.creatorId);

            return {
                id: item.id!!,
                doc: {
                    uid: item.creatorId,
                    name: user ? ((item.firstName || '') + ' ' + (item.lastName || '')) : 'unknown',
                    createdAt: (item as any).createdAt,
                    updatedAt: (item as any).updatedAt,
                }
            };
        });
}