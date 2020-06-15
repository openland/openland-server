import { Store } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';

export function declareHyperlogIndexer() {
    declareSearchIndexer({
        name: 'hyperlog',
        version: 1,
        index: 'hyperlog',
        stream: Store.HyperLog.created.stream({ batchSize: 5000 }),
        includedClusters: ['default']
    }).withProperties({
        type: {
            type: 'keyword'
        },
        date: {
            type: 'date'
        }
    }).start(async (item) => {
        let { tid, ...other } = item.body;
        return {
            id: item.id!!,
            doc: {
                type: item.type,
                date: item.date,
                body: {
                    ...other
                }
            }
        };
    });
}