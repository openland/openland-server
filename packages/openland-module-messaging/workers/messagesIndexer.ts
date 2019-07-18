import { inTx } from '@openland/foundationdb';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Store } from 'openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';

export function messagesIndexer() {
    declareSearchIndexer('message-index', 7, 'message', Store.Message.updated.stream({ batchSize: 200 }))
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
            text: {
                type: 'text'
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
                let room = await Store.Conversation.findById(ctx, item.cid);
                let userName = await Modules.Users.getUserFullName(ctx, item.uid);
                return {
                    id: item.id,
                    doc: {
                        id: item.id,
                        cid: item.cid,
                        uid: item.uid,
                        name: userName,
                        roomKind: room ? room.kind : 'unknown',
                        isService: !!item.isService,
                        deleted: !!item.deleted,
                        text: item.text || undefined,
                        createdAt: item.metadata.createdAt,
                        updatedAt: item.metadata.updatedAt,
                    }
                };
            });
        });
}