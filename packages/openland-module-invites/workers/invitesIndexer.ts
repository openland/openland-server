import { FDB } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { EmptyContext } from '@openland/context';
import { inTx } from 'foundation-orm/inTx';

export function invitesIndexer() {
    declareSearchIndexer('invites-room-index', 3, 'invites-room', FDB.ChannelInvitation.createUpdatedStream(50))
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
            let user = await inTx(EmptyContext, async (ctx) => await FDB.UserProfile.findById(ctx, item.creatorId));

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