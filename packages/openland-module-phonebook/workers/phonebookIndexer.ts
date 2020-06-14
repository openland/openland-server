import { declareSearchIndexer } from '../../openland-module-search/declareSearchIndexer';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';

export function phonebookIndexer() {
    declareSearchIndexer({
        name: 'phonebook-index',
        version: 13,
        index: 'phonebook',
        stream: Store.PhonebookItem.updated.stream({ batchSize: 200 }),
        includedClusters: ['default']
    }).withProperties({
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
    }).start(async (item, parent) => {
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
