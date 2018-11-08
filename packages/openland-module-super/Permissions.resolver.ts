import { withPermission } from 'openland-module-api/Resolvers';
import { CallContext } from 'openland-module-api/CallContext';
import { Modules } from '../openland-modules/Modules';
import { FDB } from '../openland-module-db/FDB';

export default {
    Query: {
        myPermissions: async function (_: any, _params: {}, context: CallContext) {
            return {
                roles: Modules.Super.resolvePermissions({ uid: context.uid, oid: context.oid })
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