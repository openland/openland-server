import { FDB } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { DB } from 'openland-server/tables';

export function userProfileIndexer() {
    declareSearchIndexer('user-profile-index', 4, 'user_profile', FDB.UserProfile.createByUpdatedAtStream(50))
        .withProperties({
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
        })
        .start(async (item) => {
            let shortName = await DB.ShortName.findOne({ where: { type: 'user', ownerId: item.id } });

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
                    userId: item.id,
                    search: searchData.join(' '),
                    createdAt: (item as any).createdAt,
                    updatedAt: (item as any).updatedAt,
                }
            };
        });
}