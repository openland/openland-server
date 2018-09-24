import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';

export function createUserProfilesIndexer(client: ES.Client) {
    let reader = new UpdateReader('reader_user_profiles', 5, DB.UserProfile);
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
    });
    reader.indexer(async (item) => {
        let shortName = await DB.ShortName.findOne({ where: { type: 'user', ownerId: item.userId } });

        return {
            id: item.id!!,
            doc: {
                firstName: item.firstName,
                lastName: item.lastName,
                name: (item.firstName || '') + (item.lastName || ''),
                shortName: shortName ? shortName.name : undefined,
                userId: item.userId,
            }
        };
    });
    reader.enalbeAutoOutOfOrder();
    return reader;
}