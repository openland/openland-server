import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { inTx, keyIncrement } from '@openland/foundationdb';
import { DialogNeedReindexEvent } from '../../openland-module-db/store';

const ZERO = Buffer.from([]);

export function dialogSearchIndexer() {
    declareSearchIndexer({
        name: 'dialog-index',
        version: 10,
        index: 'dialog',
        stream: Store.DialogIndexEventStore.createStream({ batchSize: 1500 })
    }).withProperties({
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
        },
        dialog_kind: {
            type: 'text'
        },
        uid2: {
            type: 'integer'
        }
    }).withAfterHandler(async (cursor, parent) => {
        // Delete all previous
        let bc = Buffer.from(cursor, 'base64');
        await inTx(parent, async (ctx) => {
            Store.DialogIndexEventStore.descriptor.subspace.clearRange(ctx, ZERO, keyIncrement(bc));
        });
    }).start(async (args, parent) => {
        if (args.item.type !== 'dialogNeedReindexEvent') {
            return null;
        }

        return await inTx(parent, async (ctx) => {
            let item = args.item.raw as DialogNeedReindexEvent;

            let title: string;
            try {
                title = await Modules.Messaging.room.resolveConversationTitle(ctx, item.cid, item.uid);
            } catch (e) {
                return {
                    id: item.cid + '_' + item.uid,
                    doc: {
                        cid: item.cid,
                        uid: item.uid,
                    }
                };
            }
            let uid2: number | undefined;
            let conv = await Store.Conversation.findById(ctx, item.cid);
            if (conv && conv.kind === 'private') {
                let privateConv = await Store.ConversationPrivate.findById(ctx, item.cid);
                uid2 = privateConv!.uid1 === item.uid ? privateConv!.uid2 : privateConv!.uid1;
            }
            // console.log(title, item, uid2);
            return {
                id: item.cid + '_' + item.uid,
                doc: {
                    title: title || '',
                    cid: item.cid,
                    uid: item.uid,
                    visible: await Modules.Messaging.hasActiveDialog(ctx, item.uid, item.cid),
                    uid2,
                    dialog_kind: conv!.kind
                }
            };
        });
    });
}