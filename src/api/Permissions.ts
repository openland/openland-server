import { CallContext } from './CallContext';
import { Repos } from '../repositories';
import { withPermission } from './utils/Resolvers';

export const Resolvers = {
    Query: {
        permissions: async function (_: any, _params: {}, context: CallContext) {
            return {
                roles: Repos.Permissions.resolvePermissions(context.uid)
            };
        },
        superAdmins: withPermission('super-admin', () => {
            return Repos.Permissions.fetchSuperAdmins();
        })
    }
};