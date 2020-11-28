import { Context } from '@openland/context';
import { UserProfile } from 'openland-module-db/store';

import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { withProfile, withUser } from 'openland-module-users/User.resolver';
import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';

export const Resolver: GQLResolver = {
    User: {
        primaryOrganization: withProfile((ctx, src, profile, authorized) => authorized ? (profile && profile.primaryOrganization ? Store.Organization.findById(ctx, profile.primaryOrganization) : null) : null, true),
        organizations: withUser(async (ctx, src) => Promise.all((await Modules.Orgs.findUserOrganizations(ctx, src.id!)).map(async oid => (await Store.Organization.findById(ctx, oid))!))),

        // Deprecated
        alphaPrimaryOrganization: withProfile(async (ctx, src, profile, authorized) => authorized ? (profile && profile.primaryOrganization ? Store.Organization.findById(ctx, profile.primaryOrganization) : null) : null, true),
    },
    Profile: {
        primaryOrganization: async (src: UserProfile, args: {}, ctx: Context) => src.primaryOrganization ? Store.Organization.findById(ctx, src.primaryOrganization) : null,

        // Deprecated
        alphaPrimaryOrganizationId: (src: UserProfile) => src.primaryOrganization ? IDs.Organization.serialize(src.primaryOrganization) : null,
        alphaPrimaryOrganization: async (src: UserProfile, args: {}, ctx: Context) => src.primaryOrganization ? Store.Organization.findById(ctx, src.primaryOrganization) : null,
    }
};
