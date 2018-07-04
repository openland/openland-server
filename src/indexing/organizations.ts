import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createOrganizationIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_organizations', 1, DB.Organization);
    reader.elastic(client, 'organizations', 'organization', {
        id: {
            type: 'integer'
        },
        name: {
            type: 'text'
        },
        location: {
            type: 'text'
        },

    });
    reader.indexer(async (item) => {
        return {
            id: item.id!!,
            doc: {
                id: item.id,
                name: item.name,
                location: (item.extras && item.extras.location) ? item.extras.location : ''
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}