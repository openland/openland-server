import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createOrganizationListingIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_organization_listings', 1, DB.OrganizationListing);
    reader.elastic(client, 'organization_listings', 'organization_listing', {
        orgId: {
            type: 'integer'
        },
        name: {
            type: 'text'
        }
    });
    reader.indexer(async (item) => {
        return {
            id: item.id!!,
            doc: {
                orgId: item.orgId,
                name: item.name
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}