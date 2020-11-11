import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';

export const Resolver: GQLResolver = {
    Query: {
        myBlackList: withUser(async (ctx, args, uid) => {
            return await Modules.BlackListModule.getUserBlackList(ctx, uid);
        })
    },

    Mutation: {
        banUser: withUser(async (ctx, args, uid) => {
            return await Modules.BlackListModule.banUser(ctx, uid, IDs.User.parse(args.id));
        }),
        unBanUser: withUser(async (ctx, args, uid) => {
            return await Modules.BlackListModule.unBanUser(ctx, uid, IDs.User.parse(args.id));
        }),
    }
};