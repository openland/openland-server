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
                let totalDeleted = 0;
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
                        let deletedEvents = 0;
                        const added = new Map<string, Buffer>();
                        const deleted = new Set<string>();
                        for (let e of bb) {
                            const eventKey = Modules.Messaging.userState.calculateDialogEventKey(e.event);
                            addedEvents++;

                            if (eventKey !== null) {

                                // Delete event from current transaction
                                if (added.has(eventKey)) {
                                    addedEvents--;
                                    deletedEvents++;
                                    Store.UserDialogEventStore.deleteKey(ctx, u.id, added.get(eventKey)!);
                                }

                                // Save event
                                added.set(eventKey, e.key);

                                // Delete previous if exists
                                if (deleted.has(eventKey)) {
                                    continue;
                                }
                                deleted.add(eventKey);
                                if (previous.has(eventKey)) {
                                    addedEvents--;
                                    deletedEvents++;
                                    Store.UserDialogEventStore.deleteKey(ctx, u.id, previous.get(eventKey)!);
                                }
                            }
                        }

                        return { added, deleted, addedEvents, deletedEvents, next: bb[bb.length - 1].key };
                    });
                    if (!nextCursor) {
                        logger.log(root, 'Compacting user completed ' + u.id + ' with ' + totalEvents + ' events and deleted ' + totalDeleted + ' events');
                        break;
                    }
                    totalEvents += nextCursor.addedEvents;
                    totalDeleted += nextCursor.deletedEvents;
                    if (nextCursor.deletedEvents > 0) {
                        logger.log(root, 'Deleted from user ' + u.id + ' ' + nextCursor.deletedEvents + ' events');
                    }
                    cursor = nextCursor.next;
                    for (let key in nextCursor.added) {
                        previous.set(key, nextCursor.added.get(key)!);
                    }
                }
            }
        });
    });
}