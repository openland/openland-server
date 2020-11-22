import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-users/User.resolver';
import { Modules } from '../../openland-modules/Modules';

export const Resolver: GQLResolver = {
    User: {
        isBanned: withUser(async (ctx, src) => {
            return await Modules.BlackListModule.isUserBanned(ctx, ctx.auth.uid!, src.id);
        }, true),
        isMeBanned: withUser(async (ctx, src) => {
            return await Modules.BlackListModule.isUserBanned(ctx, src.id, ctx.auth.uid!);
        }, true),
    }
};