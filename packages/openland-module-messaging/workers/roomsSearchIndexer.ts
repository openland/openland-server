import { inTx } from '@openland/foundationdb';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Store } from 'openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';
import { Organization } from 'openland-module-db/store';

export function roomsSearchIndexer() {
    declareSearchIndexer({
        name: 'room-index',
        version: 15,
        index: 'room',
        stream: Store.RoomProfile.updated.stream({ batchSize: 50 })
    }).withProperties({
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
        },
        isChannel: {
            type: 'boolean'
        },
        messagesCount: {
            type: 'integer'
        },
        isPremium: {
            type: 'boolean'
        }
    }).start(async (item, parent) => {
        return await inTx(parent, async (ctx) => {
            let room = await Store.ConversationRoom.findById(ctx, item.id);
            let conv = await Store.Conversation.findById(ctx, item.id);

            if (!room) {
                throw new Error('Room not found');
            }

            let membersCount = await Modules.Messaging.roomMembersCount(ctx, room.id);

            let org: Organization | null = null;
            if (room.oid) {
                org = (await Store.Organization.findById(ctx, room.oid!))!;
            }

            let isListed = room.kind === 'public';
            if (org && (org.kind !== 'community' || org.private)) {
                isListed = false;
            }
            if (conv && conv.deleted) {
                isListed = false;
            }

            return {
                id: item.id,
                doc: {
                    title: item.title.replace(/\./g, ' '), // Treat dot as space
                    cid: item.id,
                    createdAt: item.metadata.createdAt,
                    updatedAt: item.metadata.updatedAt,
                    featured: room.featured === true,
                    listed: isListed || false,
                    membersCount: membersCount,
                    oid: org ? org.id : undefined,
                    orgKind: org ? org.kind : undefined,
                    isChannel: room.isChannel || false,
                    isPremium: room.isPremium || false,
                    messagesCount: await Store.RoomMessagesCounter.get(ctx, item.id)
                }
            };
        });
    });
}
