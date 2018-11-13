import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { FDB } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';

export function dialogSearchIndexer() {
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
            let title: string;
            try {
                title = await Modules.Messaging.room.resolveConversationTitle(item.cid, item.uid);
            } catch (e) {
                console.warn(item.cid);
                console.warn(e);
                return {
                    id: item.cid,
                    doc: {
                    }
                };
            }
            return {
                id: item.cid,
                doc: {
                    title,
                    uid: item.uid,
                    visible: !!item.date,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                }
            };
        });
}