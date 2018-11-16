import { withAccount } from '../openland-module-api/Resolvers';
import { UserError } from '../openland-errors/UserError';
import { ErrorText } from '../openland-errors/ErrorText';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs } from '../openland-module-api/IDs';

function testShortName(name: string) {
    if (!/^\w*$/.test(name)) {
        throw new UserError('Invalid shortname');
    }

    if (name.length < 5) {
        throw new UserError('Too short');
    }
}

export default {
    ShortNameDestination: {
        __resolveType(src: any) {
            // TODO: Implement
            // if (src instanceof (DB.User as any)) {
            //     return 'User';
            // } else if (src instanceof (DB.Organization as any)) {
            //     return 'Organization';
            // }

            throw new Error('Unknown shortname type');
        }
    },

    Query: {
        alphaResolveShortName: withAccount(async (ctx, args, uid, orgId) => {
            let shortname = await Modules.Shortnames.findShortname(ctx, args.shortname);

            if (!shortname) {
                return null;
            }

            if (shortname.ownerType === 'user') {
                return await FDB.User.findById(ctx, shortname.ownerId);
            } else if (shortname.ownerType === 'org') {
                return await FDB.Organization.findById(ctx, shortname.ownerId);
            }

            return null;
        }),
    },
    Mutation: {
        alphaSetUserShortName: withAccount(async (ctx, args, uid, orgId) => {
            testShortName(args.shortname);

            await Modules.Shortnames.setShortnameToUser(ctx, args.shortname, uid);

            return 'ok';
        }),
        alphaSetOrgShortName: withAccount(async (ctx, args, uid) => {
            let orgId = IDs.Organization.parse(args.id);
            testShortName(args.shortname);

            let member = await FDB.OrganizationMember.findById(ctx, orgId, uid);
            if (member === null || member.status !== 'joined' || member.role !== 'admin') {
                throw new UserError(ErrorText.permissionOnlyOwner);
            }

            await Modules.Shortnames.setShortnameToOrganization(ctx, args.shortname, orgId);

            return 'ok';
        }),
    },
} as GQLResolver;