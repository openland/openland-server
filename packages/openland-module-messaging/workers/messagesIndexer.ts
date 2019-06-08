import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export function messagesIndexer() {
    declareSearchIndexer('message-index', 4, 'mesage', FDB.Message.createUpdatedStream(50))
        .withProperties({
            id: {
                type: 'integer'
            },
            cid: {
                type: 'integer'
            },
            roomKind: {
                type: 'keyword'
            },
            uid: {
                type: 'integer'
            },
            name: {
                type: 'text'
            },
            isService: {
                type: 'boolean'
            },
            deleted: {
                type: 'boolean'
            },
            createdAt: {
                type: 'date'
            },
            updatedAt: {
                type: 'date'
            },

        })
        .start(async (item, parent) => {
            return await inTx(parent, async (ctx) => {
                let room = await FDB.Conversation.findById(ctx, item.cid);
                let user = await FDB.UserProfile.findById(ctx, item.uid);
                return {
                    id: item.id,
                    doc: {
                        id: item.id,
                        cid: item.cid,
                        uid: item.uid,
                        name: user ? ((user.firstName || '') + ' ' + (user.lastName || '')) : 'unknown',
                        roomKind: room ? room.kind : 'unknown',
                        isService: !!item.isService,
                        deleted: !!item.deleted,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt,
                    }
                };
            });
        });
}