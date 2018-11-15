import { User, UserProfile } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { FDB } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { withAny } from 'openland-module-api/Resolvers';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';

type UserRoot = User | UserProfile | number;

export function withUser(handler: (ctx: AppContext, user: User) => any) {
    return async (src: UserRoot, _params: {}, ctx: AppContext) => {
        if (typeof src === 'number') {
            let user = (await (FDB.User.findById(ctx, src)))!;
            return handler(ctx, user);
        } else if (src.entityName === 'User') {
            return handler(ctx, src);
        } else {
            let user = (await (FDB.User.findById(ctx, src.id)))!;
            return handler(ctx, user);
        }
    };
}

export function withProfile(handler: (ctx: AppContext, user: User, profile: UserProfile | null) => any) {
    return async (src: UserRoot, _params: {}, ctx: AppContext) => {
        if (typeof src === 'number') {
            let user = (await (FDB.User.findById(ctx, src)))!;
            let profile = (await (FDB.UserProfile.findById(ctx, src)))!;
            return handler(ctx, user, profile);
        } else if (src.entityName === 'User') {
            let profile = (await (FDB.UserProfile.findById(ctx, src.id)))!;
            return handler(ctx, src, profile);
        } else {
            let user = (await (FDB.User.findById(ctx, src.id)))!;
            return handler(ctx, user, src);
        }

    };
}

export default {
    User: {
        id: (src: UserRoot) => IDs.User.serialize(typeof src === 'number' ? src : src.id),
        isBot: withUser((ctx, src) => src.isBot || false),
        isYou: withUser((ctx, src) => src.id === ctx.auth.uid),

        name: withProfile((ctx, src, profile) => profile ? [profile.firstName, profile.lastName].filter((v) => !!v).join(' ') : src.email),
        firstName: withProfile((ctx, src, profile) => profile ? profile.firstName : src.email),
        lastName: withProfile((ctx, src, profile) => profile ? profile.lastName : null),
        photo: withProfile((ctx, src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null),
        photoRef: withProfile((ctx, src, profile) => profile && profile.picture),

        email: withProfile((ctx, src, profile) => profile ? profile.email : null),
        phone: withProfile((ctx, src, profile) => profile ? profile.phone : null),
        about: withProfile((ctx, src, profile) => profile ? profile.about : null),
        website: withProfile((ctx, src, profile) => profile ? profile.website : null),
        linkedin: withProfile((ctx, src, profile) => profile && profile.linkedin),
        twitter: withProfile((ctx, src, profile) => profile && profile.twitter),
        location: withProfile((ctx, src, profile) => profile ? profile.location : null),

        shortname: withUser(async (ctx, src) => {
            let shortname = await Modules.Shortnames.findUserShortname(ctx, src.id);
            if (shortname) {
                return shortname.shortname;
            }
            return null;
        }),

        // Deprecated
        picture: withProfile((ctx, src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null),
        pictureRef: withProfile((ctx, src, profile) => profile && profile.picture),
        alphaRole: withProfile((ctx, src, profile) => profile && profile.role),
        alphaLinkedin: withProfile((ctx, src, profile) => profile && profile.linkedin),
        alphaTwitter: withProfile((ctx, src, profile) => profile && profile.twitter),

        channelsJoined: async (src: User) => {
            return [];
        },
        alphaLocations: withProfile((ctx, src, profile) => profile && profile.locations),
    },
    Query: {
        me: async function (_obj: any, _params: {}, ctx: AppContext) {
            if (ctx.auth.uid == null) {
                return null;
            } else {
                let profile = await FDB.User.findById(ctx, ctx.auth.uid);
                if (profile === null) {
                    return null;
                }

                return FDB.User.findById(ctx, ctx.auth.uid);
            }
        },
        user: withAny<{ id: string }>((ctx, args) => {
            return FDB.User.findById(ctx, IDs.User.parse(args.id));
        }),
    }
} as GQLResolver;