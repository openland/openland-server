import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createOrganizationIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_organizations', 7, DB.Organization);
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
        published: {
            type: 'boolean'
        },
        featured: {
            type: 'boolean'
        },
        tags: {
            type: 'keyword'
        },
        createdAt: {
            type: 'date'
        },
        updatedAt: {
            type: 'date'
        },
        isCommunity: {
            type: 'boolean'
        },
    });
    reader.indexer(async (item) => {
        let published = (!item.extras || item.extras.published !== false) && item.status === 'ACTIVATED';
        let featured = !!(item.extras && item.extras.featured);
        let isCommunity = !!(item.extras && item.extras.isCommunity);

        return {
            id: item.id!!,
            doc: {
                name: item.name,
                published: published,
                featured: featured,
                isCommunity: isCommunity,
                createdAt: (item as any).createdAt,
                updatedAt: (item as any).updatedAt,
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}