import { createLogger } from '@openland/log';
import { inTx, withoutTransaction } from '@openland/foundationdb';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { Store } from 'openland-module-db/FDB';
import { DialogNeedReindexEvent } from 'openland-module-db/store';

const logger = createLogger('compactor');

export function declareDialogIndexNeededCompactorWorker() {
    singletonWorker({ db: Store.storage.db, name: 'dialog-index-needed-compactor', delay: 10000 }, async (parent) => {
        const previous = new Map<string, Buffer>();
        let cursor: Buffer | undefined;
        const root = withoutTransaction(parent);
        let totalDeleted = 0;

        while (true) {
            let r = await inTx(root, async (ctx) => {
                let bb = await Store.DialogIndexEventStore.find(ctx, { batchSize: 1000, after: cursor });
                if (bb.length === 0) {
                    return null;
                }
                const added = new Map<string, Buffer>();
                const deleted = new Set<string>();
                let deletedKeys = 0;
                for (let b of bb) {
                    let eventKey: string | null = null;
                    if (b.event instanceof DialogNeedReindexEvent) {
                        eventKey = b.event.uid + '-' + b.event.cid;
                    }
                    if (!eventKey) {
                        continue;
                    }

                    // Delete event from current transaction
                    if (added.has(eventKey)) {
                        deletedKeys++;
                        Store.DialogIndexEventStore.deleteKey(ctx, added.get(eventKey)!);
                    }

                    // Save event
                    added.set(eventKey, b.key);

                    // Delete previous if exists
                    if (deleted.has(eventKey)) {
                        continue;
                    }
                    deleted.add(eventKey);
                    if (previous.has(eventKey)) {
                        deletedKeys++;
                        Store.DialogIndexEventStore.deleteKey(ctx, previous.get(eventKey)!);
                    }
                }
                return { added, deleted, deletedKeys, next: bb[bb.length - 1].key };
            });
            if (!r) {
                logger.log(root, 'Compacting completed with ' + totalDeleted);
                return;
            }
            totalDeleted += r.deletedKeys;
            if (r.deletedKeys > 0) {
                logger.log(root, 'Deleted  ' + r.deletedKeys + ' events');
            }
            cursor = r.next;
            for (let key in r.added) {
                previous.set(key, r.added.get(key)!);
            }
        }
    });
}