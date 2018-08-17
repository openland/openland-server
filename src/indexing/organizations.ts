import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createOrganizationIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_organizations', 6, DB.Organization);
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
        let location = (item.extras && item.extras.location) ? item.extras.location : '';
        let locations = (item.extras && item.extras.locations && item.extras.locations.length > 0) ? item.extras.locations.join(' ') : '';
        let organizationTypes = (item.extras && item.extras.organizationType && item.extras.organizationType.length > 0) ? item.extras.organizationType.join(' ') : '';
        let interests = (item.extras && item.extras.interests && item.extras.interests.length > 0) ? item.extras.interests.join(' ') : '';
        let published = (!item.extras || item.extras.published !== false) && item.status === 'ACTIVATED';
        let featured = !!(item.extras && item.extras.featured);
        let isCommunity = !!(item.extras && item.extras.isCommunity);

        let posts = await DB.WallPost.findAll({
            where: {
                orgId: item.id
            }
        });

        let tags: string[][] = posts.map(p => p.extras!.tags as string[] || []);

        let flatTags = tags.reduce((a, b) => {
            return a.concat(b);
        }, []);

        return {
            id: item.id!!,
            doc: {
                name: item.name,
                location: (location + ' ' + locations).trim(),
                organizationType: organizationTypes,
                interest: interests,
                published: published,
                featured: featured,
                isCommunity: isCommunity,
                tags: flatTags,
                createdAt: (item as any).createdAt,
                updatedAt: (item as any).updatedAt,
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}