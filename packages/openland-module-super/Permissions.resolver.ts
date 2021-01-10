// import { withPermission } from 'openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
// import { Store } from '../openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
// import { isDefined } from '../openland-utils/misc';

export const Resolver: GQLResolver = {
    Query: {
        myPermissions: async (r, args, ctx) => {
            return {
                roles: Array.from(await Modules.Super.resolvePermissions(ctx, { uid: ctx.auth.uid, oid: ctx.auth.oid }))
            };
        },
        // users: withPermission('super-admin', async (ctx, args) => {
        //     let {uids} = await Modules.Users.searchForUsers(ctx, args.query, { limit: 10 });

        //     if (uids.length === 0) {
        //         return [];
        //     }

        //     return (await Promise.all(uids.map((v) => Store.User.findById(ctx, v)))).filter(isDefined);
        // }),
    },
};
