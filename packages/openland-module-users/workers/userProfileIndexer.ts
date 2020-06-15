import { Store } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Modules } from 'openland-modules/Modules';
import { inTx } from '@openland/foundationdb';

export function userProfileIndexer() {
    declareSearchIndexer({
        name: 'user-profile-index',
        version: 17,
        index: 'user_profile',
        stream: Store.UserIndexingQueue.updated.stream({ batchSize: 50 })
    }).withProperties({
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
        ivitedBy: {
            type: 'long'
        },
        ivitedByName: {
            type: 'text'
        },
        status: {
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
    }).start(async (item, parent) => {
        return await inTx(parent, async (ctx) => {
            let profile = (await Store.UserProfile.findById(ctx, item.id));

            if (!profile) {
                return null;
            }

            let shortName = await Modules.Shortnames.findShortnameByOwner(ctx, 'user', item.id);
            let orgs = await Modules.Orgs.findUserOrganizations(ctx, item.id);

            let searchData: (string | undefined | null)[] = [];
            searchData.push(profile.firstName);
            searchData.push(profile.lastName);
            searchData.push(shortName ? shortName.shortname : undefined);
            searchData.push(profile.email);

            let invitedByName: string | undefined;
            let user = await Store.User.findById(ctx, item.id);
            if (user && user.invitedBy) {
                let inviter = await Store.UserProfile.findById(ctx, user.invitedBy);
                if (inviter) {
                    invitedByName = (inviter.firstName || '') + ' ' + (inviter.lastName || '');
                }
            }

            return {
                id: item.id!!,
                doc: {
                    firstName: profile.firstName,
                    lastName: profile.lastName || undefined,
                    name: (profile.firstName || '') + ' ' + (profile.lastName || ''),
                    shortName: shortName ? shortName.shortname : undefined,
                    userId: item.id,
                    search: searchData.join(' '),
                    primaryOrganization: profile.primaryOrganization || undefined,
                    organizations: orgs,
                    ivitedBy: user ? (user.invitedBy || undefined) : undefined,
                    letInvitedByName: invitedByName,
                    ivitedByName: invitedByName,
                    status: user!.status,
                    createdAt: item.metadata.createdAt,
                    updatedAt: item.metadata.updatedAt,
                }
            };
        });
    });
}
