import { inTx } from '@openland/foundationdb';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { Store } from 'openland-module-db/FDB';
import { HyperLogEvent } from 'openland-module-db/store';
import { Modules } from 'openland-modules/Modules';
export function declareHyperlogReaper() {
    const whiteList: string[] = [
        'wallet_payment_event',
        'wallet_purchase_event',
        'wallet_subscription_event',
        'wallet_payment_intent_event',
        'sms_sent',
        'follow',
        'voice_chat_ended'
    ];

    singletonWorker({ db: Store.storage.db, name: 'hyperlog-reaper', delay: 10000 }, async (parent) => {
        let cursor: Buffer | null = null;
        while (true) {
            await inTx(parent, async (ctx) => {
                let ex = await Store.HyperLogStore.find(ctx, { batchSize: Modules.Super.getNumber('hyperlog-reaper-batch', 1000), after: cursor ? cursor : undefined });
                for (let e of ex) {
                    cursor = e.key;

                    if (!(e.event instanceof HyperLogEvent)) {
                        Store.HyperLogStore.deleteKey(ctx, e.key);
                        continue;
                    }

                    let isWhiteListed = false;
                    for (let w of whiteList) {
                        if (w === e.event.eventType) {
                            isWhiteListed = true;
                            break;
                        }
                    }

                    if (!isWhiteListed) {
                        Store.HyperLogStore.deleteKey(ctx, e.key);
                    }
                }
            });
        }
    });
}