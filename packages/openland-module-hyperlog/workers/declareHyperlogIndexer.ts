import { FDB } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { createEmptyContext } from 'openland-utils/Context';

export function declareHyperlogIndexer() {
    declareSearchIndexer('hyperlog', 1, 'hyperlog', FDB.HyperLog.createCreatedStream(createEmptyContext(), 50))
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