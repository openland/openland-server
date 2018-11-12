import { User, UserProfile } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { CallContext } from 'openland-module-api/CallContext';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { FDB } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { withAny } from 'openland-module-api/Resolvers';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

type UserRoot = User | UserProfile | number;

export function withUser(handler: (user: User, context: CallContext) => any) {
    return async (src: UserRoot, _params: {}, context: CallContext) => {
        if (typeof src === 'number') {
            let user = (await (FDB.User.findById(src)))!;
            return handler(user, context);
        } else if (src.entityName === 'User') {
            return handler(src, context);
        } else {
            let user = (await (FDB.User.findById(src.id)))!;
            return handler(user, context);
        }
    };
}

export function withProfile(handler: (user: User, profile: UserProfile | null, context: CallContext) => any) {
    return async (src: UserRoot, _params: {}, context: CallContext) => {
        if (typeof src === 'number') {
            let user = (await (FDB.User.findById(src)))!;
            let profile = (await (FDB.UserProfile.findById(src)))!;
            return handler(user, profile, context);
        } else if (src.entityName === 'User') {
            let profile = (await (FDB.UserProfile.findById(src.id)))!;
            return handler(src, profile, context);
        } else {
            let user = (await (FDB.User.findById(src.id)))!;
            return handler(user, src, context);
        }

    };
}

export default {
    User: {
        id: (src: UserRoot) => IDs.User.serialize(typeof src === 'number' ? src : src.id),
        isBot: withUser((src: User) => src.isBot || false),
        isYou: withUser((src: User, context: CallContext) => src.id === context.uid),

        name: withProfile((src, profile) => profile ? [profile.firstName, profile.lastName].filter((v) => !!v).join(' ') : src.email),
        firstName: withProfile((src, profile) => profile ? profile.firstName : src.email),
        lastName: withProfile((src, profile) => profile ? profile.lastName : null),
        photo: withProfile((src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null),
        photoRef: withProfile((src, profile) => profile && profile.picture),

        email: withProfile((src, profile) => profile ? profile.email : null),
        phone: withProfile((src, profile) => profile ? profile.phone : null),
        about: withProfile((src, profile) => profile ? profile.about : null),
        website: withProfile((src, profile) => profile ? profile.website : null),
        linkedin: withProfile((src, profile) => profile && profile.linkedin),
        twitter: withProfile((src, profile) => profile && profile.twitter),
        location: withProfile((src, profile) => profile ? profile.location : null),

        shortname: withUser(async (src: User) => {
            let shortname = await Modules.Shortnames.findUserShortname(src.id);
            if (shortname) {
                return shortname.shortname;
            }
            return null;
        }),

        // Deprecated
        picture: withProfile((src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null),
        pictureRef: withProfile((src, profile) => profile && profile.picture),
        alphaRole: withProfile((src, profile) => profile && profile.role),
        alphaLinkedin: withProfile((src, profile) => profile && profile.linkedin),
        alphaTwitter: withProfile((src, profile) => profile && profile.twitter),

        channelsJoined: async (src: User) => {
            return [];
        },
        alphaLocations: withProfile((src, profile) => profile && profile.locations),
    },
    Query: {
        me: async function (_obj: any, _params: {}, context: CallContext) {
            if (context.uid == null) {
                return null;
            } else {
                let profile = await FDB.User.findById(context.uid);
                if (profile === null) {
                    return null;
                }

                return FDB.User.findById(context.uid);
            }
        },
        user: withAny<{ id: string }>((args) => {
            return FDB.User.findById(IDs.User.parse(args.id));
        }),
    }
} as GQLResolver;