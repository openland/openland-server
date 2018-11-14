import { withPermission } from 'openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { FDB } from '../openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';

export default {
    Query: {
        myPermissions: async function (_: any, _params: {}, ctx: AppContext) {
            return {
                roles: Array.from(await Modules.Super.resolvePermissions({ uid: ctx.auth.uid, oid: ctx.auth.oid }))
            };
        },
        users: withPermission<{ query: string }>('super-admin', async (ctx, args) => {
            let uids = await Modules.Users.searchForUsers(args.query, { limit: 10 });

            if (uids.length === 0) {
                return [];
            }

            return (await Promise.all(uids.map((v) => FDB.User.findById(v))));
        }),
    },
} as GQLResolver;