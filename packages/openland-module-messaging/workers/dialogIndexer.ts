import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { FDB } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';

export function dialogIndexer() {
    declareSearchIndexer('dialog-index', 6, 'dialog', FDB.UserDialog.createUpdatedStream(50))
        .withProperties({
            uid: {
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
            visible: {
                type: 'boolean'
            }
        })
        .start(async (item) => {
            return {
                id: item.cid,
                doc: {
                    title: await Modules.Messaging.room.resolveConversationTitle(item.cid, item.uid),
                    uid: item.uid,
                    visible: !!item.date,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                }
            };
        });
}