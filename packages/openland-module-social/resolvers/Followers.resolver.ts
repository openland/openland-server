import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withAny, withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';
import { withUser as withUserRes } from '../../openland-module-users/User.resolver';

export const Resolver: GQLResolver = {
    User: {
        followersCount: withUserRes((ctx, src) => Modules.Social.followers.getFollowersCount(ctx, src.id), true),
        followingCount: withUserRes((ctx, src) => Modules.Social.followers.getFollowingCount(ctx, src.id), true),
        followedByMe: withUserRes((ctx, src) => Modules.Social.followers.isFollowing(ctx, ctx.auth.uid!, src.id), false),
    },

    Query: {
        socialUserFollowers: withAny(async (ctx, args) => {
            let uid = IDs.User.parse(args.uid);
            let res = await Modules.Social.followers.getFollowersList(ctx, uid, 'time', {
                limit: args.first,
                after: args.after || undefined
            });
            return {
                items: res.items.map(v => v.value),
                cursor: res.haveMore ? (res.cursor || null) : null
            };
        }),
        socialUserFollowing: withAny(async (ctx, args) => {
            let uid = IDs.User.parse(args.uid);
            let res = await Modules.Social.followers.getFollowingList(ctx, uid, 'time', {
                limit: args.first,
                after: args.after || undefined
            });
            return {
                items: res.items.map(v => v.value),
                cursor: res.haveMore ? (res.cursor || null) : null
            };
        }),
    },
    Mutation: {
        socialFollow: withUser(async (ctx, args, uid) => {
            await Modules.Social.followers.follow(ctx, IDs.User.parse(args.uid), uid);
            return true;
        }),
        socialUnfollow: withUser(async (ctx, args, uid) => {
            await Modules.Social.followers.unfollow(ctx, IDs.User.parse(args.uid), uid);
            return true;
        }),
    }
};