import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createOrganizationIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_organizations', 2, DB.Organization);
    reader.elastic(client, 'organizations', 'organization', {
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
                name: item.name,
                location: (item.extras && item.extras.location) ? item.extras.location : ''
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}