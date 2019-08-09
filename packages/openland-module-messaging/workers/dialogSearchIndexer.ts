import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { DialogNeedReindexEvent } from '../../openland-module-db/store';

export function dialogSearchIndexer() {
    declareSearchIndexer('dialog-index', 9, 'dialog', Store.DialogIndexEventStore.createStream({ batchSize: 50 }))
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
            visible: {
                type: 'boolean'
            }
        })
        .start(async (event, parent) => {
            if (event.type !== 'dialogNeedReindexEvent') {
                return null;
            }

            let item = event.raw as DialogNeedReindexEvent;

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
                }
            };
        });
}