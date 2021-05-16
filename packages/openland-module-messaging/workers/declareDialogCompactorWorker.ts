import { createLogger } from '@openland/log';
import { inTx, withoutTransaction } from '@openland/foundationdb';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';

const logger = createLogger('compactor');

export function declareDialogCompactorWorker() {
    singletonWorker({ db: Store.storage.db, name: 'dialog-compactor', delay: 10000 }, async (parent) => {
        // Iterate for each user
        await Store.User.iterateAllItems(parent, 100, async (ictx, items) => {
            const root = withoutTransaction(ictx);
            for (let u of items) {
                logger.log(root, 'Compacting user ' + u.id);

                //
                // For each user
                //

                let totalEvents = 0;
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

                        let addedEvents = 0;
                        const added = new Map<string, Buffer>();
                        const deleted = new Set<string>();
                        for (let e of bb) {
                            const eventKey = Modules.Messaging.userState.calculateDialogEventKey(e.event);
                            if (eventKey !== null) {
                                added.set(eventKey, e.key);
                                addedEvents++;

                                // Delete previous
                                if (deleted.has(eventKey)) {
                                    continue;
                                }
                                addedEvents--;
                                if (previous.has(eventKey)) {
                                    deleted.add(eventKey);
                                    Store.UserDialogEventStore.deleteKey(ctx, u.id, previous.get(eventKey)!);
                                }
                            }
                        }

                        return { added, deleted, addedEvents, next: bb[bb.length - 1].key };
                    });
                    if (!nextCursor) {
                        logger.log(root, 'Compacting user completed ' + u.id + ' with ' + totalEvents + ' events');
                        break;
                    }
                    totalEvents += nextCursor.addedEvents;
                    if (nextCursor.deleted.size > 0) {
                        logger.log(root, 'Deleted from user ' + u.id + ' ' + nextCursor.deleted + ' events');
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