import { withAccount } from '../openland-module-api/Resolvers';
import { UserError } from '../openland-errors/UserError';
import { ErrorText } from '../openland-errors/ErrorText';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs, IdsFactory } from '../openland-module-api/IDs';
import { withUser } from '../openland-module-users/User.resolver';
import { AppContext } from '../openland-modules/AppContext';
import { User, Organization } from 'openland-module-db/store';

export default {
    ShortNameDestination: {
        __resolveType(src: any) {
            if (src instanceof User) {
                return 'User';
            } else if (src instanceof Organization) {
                return 'Organization';
            }

            throw new Error('Unknown shortname type');
        }
    },

    Query: {
        alphaResolveShortName: withAccount(async (ctx, args, uid, orgId) => {

            let ownerId;
            let ownerType;
            try {
                let idInfo = IdsFactory.resolve(args.shortname);
                if (idInfo.type.typeId === IDs.User.typeId) {
                    ownerType = 'user';
                } else if (idInfo.type.typeId === IDs.Organization.typeId) {
                    ownerType = 'org';
                }
                ownerId = idInfo.id as number;
            } catch {
                let shortname = await Modules.Shortnames.findShortname(ctx, args.shortname);
                if (shortname) {
                    ownerId =  shortname.ownerId;
                    ownerType = shortname.ownerType;
                }
            }
            
            if (!ownerId || !ownerType) {
                return null;
            }

            if (ownerType === 'user') {
                return await Store.User.findById(ctx, ownerId);
            } else if (ownerType === 'org') {
                return await Store.Organization.findById(ctx, ownerId);
            }

            return null;
        }),
    },
    Mutation: {
        alphaSetUserShortName: withAccount(async (ctx, args, uid, orgId) => {

            await Modules.Shortnames.setShortnameToUser(ctx, args.shortname, uid);

            return 'ok';
        }),
        alphaSetOrgShortName: withAccount(async (ctx, args, uid) => {
            let orgId = IDs.Organization.parse(args.id);

            let member = await Store.OrganizationMember.findById(ctx, orgId, uid);
            if (member === null || member.status !== 'joined' || member.role !== 'admin') {
                throw new UserError(ErrorText.permissionOnlyOwner);
            }

            await Modules.Shortnames.setShortnameToOrganization(ctx, args.shortname, orgId, uid);

            return 'ok';
        }),
    },

    User: {
        shortname: withUser(async (ctx, src) => {
            let shortname = await Modules.Shortnames.findUserShortname(ctx, src.id);
            if (shortname) {
                return shortname.shortname;
            }
            return null;
        }),
    },
    Profile: {
        shortname: withUser(async (ctx, src) => {
            let shortname = await Modules.Shortnames.findUserShortname(ctx, src.id);
            if (shortname) {
                return shortname.shortname;
            }
            return null;
        }),
    },
    Organization: {
        shortname: async (src: Organization, args: {}, ctx: AppContext) => {
            let shortName = await Modules.Shortnames.findOrganizationShortname(ctx, src.id);

            if (shortName) {
                return shortName.shortname;
            }

            return null;
        },
    },
    OrganizationProfile: {
        shortname: async (src: Organization, args: {}, ctx: AppContext) => {
            let shortName = await Modules.Shortnames.findOrganizationShortname(ctx, src.id);

            if (shortName) {
                return shortName.shortname;
            }

            return null;
        },
    }
} as GQLResolver;