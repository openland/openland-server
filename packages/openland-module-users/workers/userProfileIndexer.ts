import { FDB } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Modules } from 'openland-modules/Modules';
import { Repos } from 'openland-server/repositories';

export function userProfileIndexer() {
    declareSearchIndexer('user-profile-index', 6, 'user_profile', FDB.UserProfile.createByUpdatedAtStream(50))
        .withProperties({
            primaryOrganization: {
                type: 'keyword'
            },
            organizations: {
                type: 'keyword'
            },
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
            let shortName = await Modules.Shortnames.findUserShortname(item.id);
            let orgs = await Repos.Users.fetchUserAccounts(item.id);

            let searchData: (string | undefined | null)[] = [];
            searchData.push(item.firstName);
            searchData.push(item.lastName);
            searchData.push(shortName ? shortName.shortname : undefined);
            searchData.push(item.email);

            return {
                id: item.id!!,
                doc: {
                    firstName: item.firstName,
                    lastName: item.lastName,
                    name: (item.firstName || '') + (item.lastName || ''),
                    shortName: shortName ? shortName.shortname : undefined,
                    userId: item.id,
                    search: searchData.join(' '),
                    primaryOrganization: item.primaryOrganization,
                    organizations: orgs,
                    createdAt: (item as any).createdAt,
                    updatedAt: (item as any).updatedAt,
                }
            };
        });
}