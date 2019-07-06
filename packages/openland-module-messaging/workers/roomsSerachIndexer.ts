import { inTx } from '@openland/foundationdb';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { FDB, Store } from 'openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';
import { Organization } from 'openland-module-db/store';

export function roomsSearchIndexer() {
    declareSearchIndexer('room-index', 9, 'room', FDB.RoomProfile.createUpdatedStream(50))
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
            oid: {
                type: 'integer'
            },
            orgKind: {
                type: 'text'
            }
        })
        .start(async (item, parent) => {
            return await inTx(parent, async (ctx) => {
                let room = await FDB.ConversationRoom.findById(ctx, item.id);

                if (!room) {
                    throw new Error('Room not found');
                }

                let membersCount = await Modules.Messaging.roomMembersCount(ctx, room.id);

                let org: Organization | null = null;
                if (room.oid) {
                    org = (await Store.Organization.findById(ctx, room.oid!))!;
                }

                let isListed = room.kind === 'public' && org && org.kind === 'community' && !org.private;

                return {
                    id: item.id,
                    doc: {
                        title: item.title,
                        cid: item.id,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt,
                        featured: room.featured === true,
                        listed: isListed || false,
                        membersCount: membersCount,
                        oid: org ? org.id : undefined,
                        orgKind: org ? org.kind : undefined
                    }
                };
            });
        });
}