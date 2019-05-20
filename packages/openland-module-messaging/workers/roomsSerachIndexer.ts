import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { FDB } from 'openland-module-db/FDB';
import { createEmptyContext } from 'openland-utils/Context';
import { Modules } from '../../openland-modules/Modules';

export function roomsSearchIndexer() {
    declareSearchIndexer('room-index', 8, 'room', FDB.RoomProfile.createUpdatedStream(createEmptyContext(), 50))
        .withProperties({
            cid: {
                type: 'integer'
            },
            title: {
                type: 'text'
            },
            createdAt: {
                type: 'date'
            },
            updatedAt: {
                type: 'date'
            },
            featured: {
                type: 'boolean'
            },
            listed: {
                type: 'boolean'
            },
            membersCount: {
                type: 'integer'
            },
        })
        .start(async (item) => {
            let ctx = createEmptyContext();
            let room = await FDB.ConversationRoom.findById(ctx, item.id);

            if (!room) {
                throw new Error('Room not found');
            }

            let membersCount = await Modules.Messaging.roomMembersCount(ctx, room.id);

            let org = (await FDB.Organization.findById(ctx, room.oid!))!;

            let isListed = room.kind === 'public' && org.kind === 'community' && !org.private;

            return {
                id: item.id,
                doc: {
                    title: item.title,
                    cid: item.id,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    featured: room.featured === true,
                    listed: isListed,
                    membersCount: membersCount
                }
            };
        });
}