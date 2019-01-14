import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { FDB } from 'openland-module-db/FDB';
import { createEmptyContext } from 'openland-utils/Context';
import { Modules } from '../../openland-modules/Modules';

export function roomsSearchIndexer() {
    declareSearchIndexer('room-index', 6, 'room', FDB.RoomProfile.createUpdatedStream(createEmptyContext(), 50))
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

            return {
                id: item.id,
                doc: {
                    title: item.title,
                    cid: item.id,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    featured: room.featured || false,
                    listed: room.listed || true,
                    membersCount: membersCount
                }
            };
        });
}