import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createUserProfilesIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_user_profiles', 8, DB.UserProfile);
    reader.elastic(client, 'user_profiles', 'user_profile', {
        firstName: {
            type: 'text'
        },
        lastName: {
            type: 'text'
        },
        shortName: {
            type: 'text'
        },
        name: {
            type: 'text'
        },
        userId: {
            type: 'long'
        },
        createdAt: {
            type: 'date'
        },
        updatedAt: {
            type: 'date'
        },
        search: {
            type: 'text'
        },
    });
    reader.indexer(async (item) => {
        let shortName = await DB.ShortName.findOne({ where: { type: 'user', ownerId: item.userId } });

        let searchData: (string | undefined | null)[] = [];
        searchData.push(item.firstName);
        searchData.push(item.lastName);
        searchData.push(shortName ? shortName.name : undefined);
        searchData.push(item.email);

        return {
            id: item.id!!,
            doc: {
                firstName: item.firstName,
                lastName: item.lastName,
                name: (item.firstName || '') + (item.lastName || ''),
                shortName: shortName ? shortName.name : undefined,
                userId: item.userId,
                search: searchData.join(' '),
                createdAt: (item as any).createdAt,
                updatedAt: (item as any).updatedAt,
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}