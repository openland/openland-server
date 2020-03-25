import { declareSearchIndexer } from '../../openland-module-search/declareSearchIndexer';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';

export function phonebookIndexer() {
    declareSearchIndexer('phonebook-index', 11, 'phonebook', Store.PhonebookItem.updated.stream({ batchSize: 200 }))
        .withProperties({
            id: {
                type: 'integer'
            },
            uid: {
                type: 'integer'
            },
            name: {
                type: 'text'
            },
            phone: {
                type: 'keyword'
            },
            info: {
                type: 'text'
            },
            createdAt: {
                type: 'date'
            },
            updatedAt: {
                type: 'date'
            },
        })
        .start(async (item, parent) => {
            return await inTx(parent, async (ctx) => {
                console.log(77777, item);
                return {
                    id: item.id,
                    doc: {
                        uid: item.uid,
                        name: item.name,
                        phone: item.phone,
                        info: item.info || undefined
                    }
                };
            });
        });
}
