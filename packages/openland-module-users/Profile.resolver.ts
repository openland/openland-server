import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { withUser } from 'openland-module-api/Resolvers';
import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { ProfileInput } from './ProfileInput';

const resolveInput = (input: GQL.ProfileInput): ProfileInput => {
    return {
        ...input,
        status: input.status ? {
            badge: input.status.badge?.id ? {  id: IDs.ModernBadge.parse(input.status.badge.id) } : null,
            custom: input.status.custom
        } : null
    };
};

export const Resolver: GQLResolver = {
    Profile: {
        id: (src) => IDs.Profile.serialize(src.id!!),
        firstName: (src) => src.firstName,
        lastName: (src) => src.lastName,
        photoRef: (src) => src.picture,
        email: async (src, args, ctx) => (await Store.User.findById(ctx, src.id))!.email,
        phone: async (src, args, ctx) => (await Store.User.findById(ctx, src.id))!.phone,
        website: (src) => src.website,
        about: (src) => src.about,
        location: (src) => src.location,
        linkedin: (src) => src.linkedin,
        instagram: (src) => src.instagram,
        twitter: (src) => src.twitter,
        facebook: (src) => src.facebook,
        primaryBadge: (src, args, ctx) => src.primaryBadge ? Store.UserBadge.findById(ctx, src.primaryBadge) : null,
        authEmail: async (src, args, ctx) => (await Store.User.findById(ctx, src.id))!.email,
        status: async (src) => src.modernStatus,
        alphaRole: (src) => src.role,
        alphaLocations: (src) => src.locations,
        alphaLinkedin: (src) => src.linkedin,
        alphaTwitter: (src) => src.twitter,
        alphaJoinedAt: (src) => src.metadata.createdAt + '',
        alphaInvitedBy: async (src, args, ctx) => {
            let user = await Store.User.findById(ctx, src.id);
            if (user && user.invitedBy) {
                return await Store.User.findById(ctx, user.invitedBy);
            }
            return null;
        },
        birthDay: async (src, args, ctx) => src.birthDay,
    },
    Query: {
        myProfile: async (src, args, ctx) => {
            if (ctx.auth.uid == null) {
                return null;
            }
            return await Modules.Users.profileById(ctx, ctx.auth.uid);
        },
    },
    Mutation: {
        profileCreate: withUser(async (parent, args, uid) => {
            return await inTx(parent, async (ctx) => {
                if (args.inviteKey) {
                    await Modules.Users.userBindInvitedBy(ctx, uid, args.inviteKey);
                }
                let res = await Modules.Users.createUserProfile(ctx, uid, resolveInput(args.input));
                return res;
            });
        }),
        profileUpdate: withUser(async (parent, args, uid) => {
            return await Modules.Users.updateUserProfile(parent, (args.uid ? IDs.User.parse(args.uid) : null) || uid, resolveInput(args.input));
        }),
    }
};
