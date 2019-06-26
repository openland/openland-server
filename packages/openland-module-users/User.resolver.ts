import { User, UserProfile } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { FDB, Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { withAny } from 'openland-module-api/Resolvers';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { NotFoundError } from '../openland-errors/NotFoundError';

type UserRoot = User | UserProfile | number | UserFullRoot;

class UserFullRoot {
    public readonly user: User;
    public readonly profile: UserProfile;

    constructor(user: User, profile: UserProfile) {
        this.user = user;
        this.profile = profile;
    }
}

export async function userRootFull(ctx: AppContext, uid: number) {
    let user = (await (FDB.User.findById(ctx, uid)))!;
    let profile = (await (FDB.UserProfile.findById(ctx, uid)))!;

    return new UserFullRoot(user, profile);
}

export function withUser(handler: (ctx: AppContext, user: User) => any) {
    return async (src: UserRoot, _params: {}, ctx: AppContext) => {
        if (typeof src === 'number') {
            let user = (await (FDB.User.findById(ctx, src)))!;
            return handler(ctx, user);
        } else if (src instanceof UserFullRoot) {
            return handler(ctx, src.user);
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
        } else if (src instanceof UserFullRoot) {
            return handler(ctx, src.user, src.profile);
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
        id: withUser((ctx, src) => IDs.User.serialize(src.id)),
        isBot: withUser((ctx, src) => src.isBot || false),
        isYou: withUser((ctx, src) => src.id === ctx.auth.uid),

        name: withProfile((ctx, src, profile) => profile ? [profile.firstName, profile.lastName].filter((v) => !!v).join(' ') : src.email),
        firstName: withProfile((ctx, src, profile) => profile ? profile.firstName : src.email),
        lastName: withProfile((ctx, src, profile) => profile ? profile.lastName : null),
        photo: withProfile((ctx, src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null),
        photoRef: withProfile((ctx, src, profile) => profile && profile.picture),

        email: withProfile((ctx, src, profile) => profile ? (src.isBot ? null : profile.email) : null),
        phone: withProfile((ctx, src, profile) => profile ? profile.phone : null),
        about: withProfile((ctx, src, profile) => profile ? profile.about : null),
        website: withProfile((ctx, src, profile) => profile ? profile.website : null),
        linkedin: withProfile((ctx, src, profile) => profile && profile.linkedin),
        twitter: withProfile((ctx, src, profile) => profile && profile.twitter),
        location: withProfile((ctx, src, profile) => profile ? profile.location : null),
        audienceSize: withUser(async (ctx, src) => await Store.UserAudienceCounter.get(ctx, src.id)),

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
            if (!ctx.auth.uid) {
                return null;
            } else {
                return userRootFull(ctx, ctx.auth.uid);
            }
        },
        user: withAny(async (ctx, args) => {
            let shortname = await Modules.Shortnames.findShortname(ctx, args.id);
            let user: User|null;

            if (shortname && shortname.enabled && shortname.ownerType === 'user') {
                user = await FDB.User.findById(ctx, shortname.ownerId);
            }  else {
                user = await FDB.User.findById(ctx, IDs.User.parse(args.id));
            }
            if (user && user.status === 'deleted') {
                throw new NotFoundError();
            }
            return user;
        }),
    }
} as GQLResolver;