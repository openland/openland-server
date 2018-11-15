import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { FDB } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { createEmptyContext } from 'openland-utils/Context';

export function dialogSearchIndexer() {
    declareSearchIndexer('dialog-index', 8, 'dialog', FDB.UserDialog.createUpdatedStream(createEmptyContext(), 50))
        .withProperties({
            cid: {
                type: 'integer'
            },
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
                title = await Modules.Messaging.room.resolveConversationTitle(createEmptyContext(), item.cid, item.uid);
            } catch (e) {
                return {
                    id: item.cid + '_' + item.uid,
                    doc: {
                        cid: item.cid,
                        uid: item.uid,
                    }
                };
            }
            return {
                id: item.cid + '_' + item.uid,
                doc: {
                    title,
                    cid: item.cid,
                    uid: item.uid,
                    visible: !!item.date,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                }
            };
        });
}