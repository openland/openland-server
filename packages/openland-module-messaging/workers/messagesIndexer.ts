import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { FDB } from 'openland-module-db/FDB';
import { createEmptyContext } from 'openland-utils/Context';

export function messagesIndexer() {
    declareSearchIndexer('message-index', 3, 'mesage', FDB.Message.createUpdatedStream(createEmptyContext(), 50))
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
        .start(async (item) => {
            let room = (await FDB.Conversation.findById(createEmptyContext(), item.cid));
            return {
                id: item.id,
                doc: {
                    id: item.id,
                    cid: item.cid,
                    uid: item.uid,
                    roomKind: room ? room.kind : 'unknown',
                    isService: !!item.isService,
                    deleted: !!item.deleted,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                }
            };
        });
}