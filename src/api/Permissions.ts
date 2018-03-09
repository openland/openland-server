import { CallContext } from './CallContext';
import { Repos } from '../repositories';
import { withPermission } from './utils/Resolvers';
import { ID } from '../modules/ID';
import { Organization } from '../tables/Organization';

const SuperAccountId = new ID('SuperAccount');

export const Resolvers = {
    SuperAccount: {
        id: (src: Organization) => SuperAccountId.serialize(src.id!!),
        title: (src: Organization) => src.title!!,
        state: (src: Organization) => src.status,
        members: (src: Organization) => Repos.Users.fetchOrganizationMembers(src.id!!)
    },
    Query: {
        permissions: async function (_: any, _params: {}, context: CallContext) {
            return {
                roles: Repos.Permissions.resolvePermissions(context.uid)
            };
        },
        superAdmins: withPermission('super-admin', () => {
            return Repos.Permissions.fetchSuperAdmins();
        }),
        superAccounts: withPermission('super-admin', () => {
            return Repos.Super.fetchAllOrganizations();
        }),
        superAccount: withPermission<{ id: string }>('super-admin', (args) => {
            return Repos.Super.fetchById(SuperAccountId.parse(args.id));
        }),
    },
    Mutation: {
        superAccountAdd: withPermission<{ title: string }>('super-admin', (args) => {
            return Repos.Super.createOrganization(args.title);
        }),
        superAccountActivate: withPermission<{ id: string }>('super-admin', (args) => {
            return Repos.Super.activateOrganization(SuperAccountId.parse(args.id));
        }),
        superAccountSuspend: withPermission<{ id: string }>('super-admin', (args) => {
            return Repos.Super.suspendOrganization(SuperAccountId.parse(args.id));
        })
    }
};