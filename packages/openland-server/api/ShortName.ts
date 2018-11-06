import { DB } from '../tables';
import { withAccount } from './utils/Resolvers';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';

function testShortName(name: string) {
    if (!/^\w*$/.test(name)) {
        throw new UserError('Invalid shortname');
    }

    if (name.length < 5) {
        throw new UserError('Too short');
    }
}

export const Resolvers = {
    ShortNameDestination: {
        __resolveType(src: any) {
            if (src instanceof (DB.User as any)) {
                return 'User';
            } else if (src instanceof (DB.Organization as any)) {
                return 'Organization';
            }

            throw new Error('Unknown shortname type');
        }
    },

    Query: {
        alphaResolveShortName: withAccount<{ shortname: string }>(async (args, uid, orgId) => {
            let shortname = await Modules.Shortnames.findShortname(args.shortname);

            if (!shortname) {
                return null;
            }

            if (shortname.ownerType === 'user') {
                return await DB.User.findById(shortname.ownerId);
            } else if (shortname.ownerType === 'org') {
                return await DB.Organization.findById(shortname.ownerId);
            }

            return null;
        }),
    },
    Mutation: {
        alphaSetUserShortName: withAccount<{ shortname: string }>(async (args, uid, orgId) => {
            testShortName(args.shortname);

            await Modules.Shortnames.setShortnameToUser(args.shortname, uid);

            return 'ok';
        }),
        alphaSetOrgShortName: withAccount<{ shortname: string, id: number }>(async (args, uid, orgId) => {
            testShortName(args.shortname);

            let member = await FDB.OrganizationMember.findById(args.id, uid);
            if (member === null || member.status !== 'joined' || member.role !== 'admin') {
                throw new UserError(ErrorText.permissionOnlyOwner);
            }

            await Modules.Shortnames.setShortnameToOrganization(args.shortname, args.id);

            return 'ok';
        }),
    },
};