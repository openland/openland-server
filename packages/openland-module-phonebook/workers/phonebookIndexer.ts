import { declareSearchIndexer } from '../../openland-module-search/declareSearchIndexer';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';

export function phonebookIndexer() {
    declareSearchIndexer('phonebook-index', 13, 'phonebook', Store.PhonebookItem.updated.stream({ batchSize: 200 }))
        .withProperties({
            id: {
                type: 'integer'
            },
            uid: {
                type: 'integer'
            },
            firstName: {
                type: 'text'
            },
            lastName: {
                type: 'text'
            },
            phones: {
                type: 'text'
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
                return {
                    id: item.id,
                    doc: {
                        uid: item.uid,
                        firstName: item.firstName,
                        lastName: item.lastName || '',
                        phones: item.phones.join(' '),
                        info: item.info || undefined
                    }
                };
            });
        });
}
