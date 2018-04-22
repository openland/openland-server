import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createProspectingIndexer(client: ES.Client) {
    let reader = new UpdateReader('prospecting_indexing_1', DB.Opportunities);
    reader.elastic(client, 'prospecting', 'opportunity', {
        orgId: {
            type: 'integer'
        },
        area: {
            type: 'integer'
        },
        state: {
            type: 'keyword'
        }
    });
    reader.include([{
        model: DB.Lot,
        as: 'lot'
    }]);
    reader.indexer((item) => {
        return {
            id: item.id!!,
            doc: {
                area: item.lot!!.extras!!.assessor_area ? item.lot!!.extras!!.assessor_area : item.lot!!.extras!!.area,
                state: item.state,
                orgId: item.organizationId
            }
        };
    });
    reader.enalbeAutoOutOfOrder();

    return reader;
}