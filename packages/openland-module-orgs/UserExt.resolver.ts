
import { Modules } from 'openland-modules/Modules';
import { UserProfile, User } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { withProfile, withUser } from 'openland-module-users/User.resolver';

async function loadPrimatyOrganization(profile: UserProfile | null, src: User) {
    let orgId = (profile && profile.primaryOrganization) || (await Modules.Orgs.findUserOrganizations(src.id))[0];
    return orgId ? FDB.Organization.findById(orgId) : undefined;
}

export default {
    User: {
        primaryOrganization: withProfile(async (src, profile) => loadPrimatyOrganization(profile, src)),
        organizations: withUser(async (src: User) => (await Modules.Orgs.findUserOrganizations(src.id!)).map(async oid => await FDB.Organization.findById(oid))),
        alphaPrimaryOrganization: withProfile(async (src, profile) => loadPrimatyOrganization(profile, src)),
    }
};