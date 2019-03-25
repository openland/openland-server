import { FDB } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Modules } from 'openland-modules/Modules';
import { createEmptyContext } from 'openland-utils/Context';

export function userProfileIndexer() {
    declareSearchIndexer('user-profile-index', 15, 'user_profile', FDB.UserIndexingQueue.createUpdatedStream(createEmptyContext(), 50))
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
            ivitedBy: {
                type: 'long'
            },
            ivitedByName: {
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
            let ctx = createEmptyContext();
            let profile = (await FDB.UserProfile.findById(ctx, item.id));

            if (!profile) {
                return null;
            }

            let shortName = await Modules.Shortnames.findUserShortname(ctx, item.id);
            let orgs = await Modules.Orgs.findUserOrganizations(ctx, item.id);

            let searchData: (string | undefined | null)[] = [];
            searchData.push(profile.firstName);
            searchData.push(profile.lastName);
            searchData.push(shortName ? shortName.shortname : undefined);
            searchData.push(profile.email);

            let invitedByName: string | undefined;
            let user = await FDB.User.findById(ctx, item.id);
            if (user && user.invitedBy) {
                let inviter = await FDB.UserProfile.findById(ctx, user.invitedBy);
                if (inviter) {
                    invitedByName = (inviter.firstName || '') + ' ' + (inviter.lastName || '');
                }
            }

            return {
                id: item.id!!,
                doc: {
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    name: (profile.firstName || '') + ' ' + (profile.lastName || ''),
                    shortName: shortName ? shortName.shortname : undefined,
                    userId: item.id,
                    search: searchData.join(' '),
                    primaryOrganization: profile.primaryOrganization,
                    organizations: orgs,
                    ivitedBy: user ? user.invitedBy : undefined,
                    letInvitedByName: invitedByName,
                    ivitedByName: invitedByName,
                    status: user!.status,
                    createdAt: (item as any).createdAt,
                    updatedAt: (item as any).updatedAt,
                }
            };
        });
}