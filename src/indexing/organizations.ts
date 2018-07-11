import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createOrganizationIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_organizations', 3, DB.Organization);
    reader.elastic(client, 'organizations', 'organization', {
        name: {
            type: 'text'
        },
        location: {
            type: 'text'
        },
        organizationType: {
            type: 'text'
        },
        interest: {
            type: 'text'
        },

    });
    reader.indexer(async (item) => {
        let location = (item.extras && item.extras.location) ? item.extras.location : '';
        let locations = (item.extras && item.extras.locations && item.extras.locations.length > 0) ? item.extras.locations.join(' ') : '';
        let organizationTypes = (item.extras && item.extras.organizationType && item.extras.organizationType.length > 0) ? item.extras.organizationType.join(' ') : '';
        let interests = (item.extras && item.extras.interests && item.extras.interests.length > 0) ? item.extras.interests.join(' ') : '';

        return {
            id: item.id!!,
            doc: {
                name: item.name,
                location: (location + ' ' + locations).trim(),
                organizationType: organizationTypes,
                interest: interests,
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}