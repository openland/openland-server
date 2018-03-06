import { CallContext } from './CallContext';
import { Repos } from '../repositories';

export const Resolvers = {
    Query: {
        permissions: async function (_: any, _params: {}, context: CallContext) {
            return {
                roles: Repos.Permissions.resolvePermissions(context.uid)
            };
        }
    }
};