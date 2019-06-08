import { FDB } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';

export function declareHyperlogIndexer() {
    declareSearchIndexer('hyperlog', 1, 'hyperlog', FDB.HyperLog.createCreatedStream(5000))
        .withProperties({
            type: {
                type: 'keyword'
            },
            date: {
                type: 'date'
            }
        })
        .start(async (item) => {
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