
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { withProfile, withUser } from 'openland-module-users/User.resolver';
import { UserProfile } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';

export default {
    User: {
        primaryOrganization: withProfile((src, profile) => profile && profile.primaryOrganization ? FDB.Organization.findById(profile.primaryOrganization) : null),
        organizations: withUser(async (src) => (await Modules.Orgs.findUserOrganizations(src.id!)).map(async oid => await FDB.Organization.findById(oid))),
        
        // Deprecated
        alphaPrimaryOrganization: withProfile(async (src, profile) => profile && profile.primaryOrganization ? FDB.Organization.findById(profile.primaryOrganization) : null),
    },
    Profile: {
        primaryOrganization: async (src: UserProfile) => src.primaryOrganization ? FDB.Organization.findById(src.primaryOrganization) : null,

        // Deprecated
        alphaPrimaryOrganizationId: (src: UserProfile) => src.primaryOrganization ? IDs.Organization.serialize(src.primaryOrganization) : null,
        alphaPrimaryOrganization: async (src: UserProfile) => src.primaryOrganization ? FDB.Organization.findById(src.primaryOrganization) : null,
    }
};