import { Repos } from 'openland-server/repositories';
import { withPermission } from 'openland-server/api/utils/Resolvers';
import { CallContext } from 'openland-server/api/utils/CallContext';
import { Modules } from '../openland-modules/Modules';
import { FDB } from '../openland-module-db/FDB';

export default {
    Query: {
        myPermissions: async function (_: any, _params: {}, context: CallContext) {
            return {
                roles: Repos.Permissions.resolvePermissions({ uid: context.uid, oid: context.oid })
            };
        },
        users: withPermission<{ query: string }>('super-admin', async (args) => {
            let uids = await Modules.Users.searchForUsers(args.query, { limit: 10 });

            if (uids.length === 0) {
                return [];
            }

            return (await Promise.all(uids.map((v) => FDB.User.findById(v))));
        }),
    },
};