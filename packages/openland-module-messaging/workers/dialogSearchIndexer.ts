import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { inTx } from '@openland/foundationdb';

export function dialogSearchIndexer() {
    declareSearchIndexer('dialog-index', 8, 'dialog', Store.UserDialog.updated.stream({ batchSize: 50 }))
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
        .start(async (item, parent) => {
            let title: string;
            try {
                title = await inTx(parent, async (ctx) => await Modules.Messaging.room.resolveConversationTitle(ctx, item.cid, item.uid));
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
                    title: title || '',
                    cid: item.cid,
                    uid: item.uid,
                    visible: await Modules.Messaging.hasActiveDialog(parent, item.uid, item.cid),
                    createdAt: item.metadata.createdAt,
                    updatedAt: item.metadata.updatedAt,
                }
            };
        });
}