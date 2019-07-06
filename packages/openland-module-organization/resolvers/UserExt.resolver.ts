import { UserProfile } from 'openland-module-db/store';

import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { withProfile, withUser } from 'openland-module-users/User.resolver';
import { IDs } from 'openland-module-api/IDs';
import { AppContext } from 'openland-modules/AppContext';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';

export default {
    User: {
        primaryOrganization: withProfile((ctx, src, profile) => profile && profile.primaryOrganization ? Store.Organization.findById(ctx, profile.primaryOrganization) : null),
        organizations: withUser(async (ctx, src) => (await Modules.Orgs.findUserOrganizations(ctx, src.id!)).map(async oid => await Store.Organization.findById(ctx, oid))),

        // Deprecated
        alphaPrimaryOrganization: withProfile(async (ctx, src, profile) => profile && profile.primaryOrganization ? Store.Organization.findById(ctx, profile.primaryOrganization) : null),
    },
    Profile: {
        primaryOrganization: async (src: UserProfile, args: {}, ctx: AppContext) => src.primaryOrganization ? Store.Organization.findById(ctx, src.primaryOrganization) : null,

        // Deprecated
        alphaPrimaryOrganizationId: (src: UserProfile) => src.primaryOrganization ? IDs.Organization.serialize(src.primaryOrganization) : null,
        alphaPrimaryOrganization: async (src: UserProfile, args: {}, ctx: AppContext) => src.primaryOrganization ? Store.Organization.findById(ctx, src.primaryOrganization) : null,
    }
} as GQLResolver;