import { inTx, withoutTransaction } from '@openland/foundationdb';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';

export function declareDialogCompactorWorker() {
    singletonWorker({ db: Store.storage.db, name: 'dialog-compactor', delay: 10000 }, async (parent) => {
        // Iterate for each user
        await Store.User.iterateAllItems(parent, 100, async (ictx, items) => {
            const root = withoutTransaction(ictx);
            for (let u of items) {

                //
                // For each user
                //

                let cursor: Buffer | undefined;
                const previous = new Map<string, Buffer>();

                //
                // For each event
                //

                while (true) {
                    const nextCursor = await inTx(root, async (ctx) => {
                        let bb = await Store.UserDialogEventStore.find(ctx, u.id, { batchSize: 1000, after: cursor });
                        if (bb.length === 0) {
                            return null;
                        }

                        //
                        // Delete previous
                        // and mark current
                        //

                        const added = new Map<string, Buffer>();
                        const deleted = new Set<string>();
                        for (let e of bb) {
                            const eventKey = Modules.Messaging.userState.calculateDialogEventKey(e.event);
                            if (eventKey !== null) {
                                added.set(eventKey, e.key);

                                // Delete previous
                                if (deleted.has(eventKey)) {
                                    continue;
                                }
                                if (previous.has(eventKey)) {
                                    deleted.add(eventKey);
                                    Store.UserDialogEventStore.deleteKey(ctx, u.id, previous.get(eventKey)!);
                                }
                            }
                        }

                        return { added, next: bb[bb.length - 1].key };
                    });
                    if (!nextCursor) {
                        break;
                    }
                    cursor = nextCursor.next;
                    for (let a of nextCursor.added) {
                        previous.set(a[0], a[1]);
                    }
                }
            }
        });
    });
}