import DataLoader from 'dataloader';
import { User, UserProfile } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { CallContext } from 'openland-server/api/utils/CallContext';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Repos } from 'openland-server/repositories';
import { FDB } from 'openland-module-db/FDB';
import { IDs } from 'openland-server/api/utils/IDs';

function userLoader(context: CallContext) {
    if (!context.cache.has('__profile_loader')) {
        context.cache.set('__profile_loader', new DataLoader<number, UserProfile | null>(async (ids) => {
            let foundTokens = ids.map((v) => Modules.Users.profileById(v));

            let res: (UserProfile | null)[] = [];
            for (let i of ids) {
                let found = false;
                for (let f of foundTokens) {
                    let f2 = (await f);
                    if (f2 && i === f2.id) {
                        res.push(f2);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    res.push(null);
                }
            }
            return res;
        }));
    }
    let loader = context.cache.get('__profile_loader') as DataLoader<number, UserProfile | null>;
    return loader;
}

function withProfile(handler: (user: User, profile: UserProfile | null, context: CallContext) => any) {
    return async (src: User, _params: {}, context: CallContext) => {
        let loader = userLoader(context);
        let profile = await loader.load(src.id!!);
        return handler(src, profile, context);
    };
}

export default {
    User: {
        id: (src: User) => IDs.User.serialize(src.id!!),
        name: withProfile((src, profile) => profile ? [profile.firstName, profile.lastName].filter((v) => !!v).join(' ') : src.email),
        firstName: withProfile((src, profile) => profile ? profile.firstName : src.email),
        lastName: withProfile((src, profile) => profile ? profile.lastName : null),

        picture: withProfile((src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null),
        pictureRef: withProfile((src, profile) => profile && profile.picture),
        photo: withProfile((src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null),
        photoRef: withProfile((src, profile) => profile && profile.picture),

        email: withProfile((src, profile) => profile ? profile.email : null),
        phone: withProfile((src, profile) => profile ? profile.phone : null),
        about: withProfile((src, profile) => profile ? profile.about : null),
        website: withProfile((src, profile) => profile ? profile.website : null),
        alphaRole: withProfile((src, profile) => profile && profile.role),
        alphaLinkedin: withProfile((src, profile) => profile && profile.linkedin),
        alphaTwitter: withProfile((src, profile) => profile && profile.twitter),
        location: withProfile((src, profile) => profile ? profile.location : null),

        isCreated: withProfile((src, profile) => !!profile),
        isBot: (src: User) => src.isBot || false,
        isYou: (src: User, args: {}, context: CallContext) => src.id === context.uid,
        alphaPrimaryOrganization: withProfile(async (src, profile, context) => Repos.Users.loadPrimatyOrganization(context, profile, src)),
        online: async (src: User) => await Repos.Users.isUserOnline(src.id!),
        lastSeen: async (src: User) => Modules.Presence.getLastSeen(src.id!), // await Repos.Users.getUserLastSeen(src.id!),
        createdChannels: async (src: User) => {
            return [];
        },
        channelsJoined: async (src: User) => {
            return [];
        },
        shortname: async (src: User) => {
            let shortname = await Modules.Shortnames.findUserShortname(src.id!);
            if (shortname) {
                return shortname.shortname;
            }
            return null;
        },
        phones: async (src: User) => [],
        lastIP: async (src: User) => Repos.Users.getUserLastIp(src.id!),
        alphaConversationSettings: async (src: User, _: any, context: CallContext) => await Modules.Messaging.getConversationSettings(context.uid!!, (await Modules.Messaging.conv.resolvePrivateChat(context.uid!!, src.id!)).id),
        status: async (src: User) => src.status,
        alphaLocations: withProfile((src, profile) => profile && profile.locations),
        organizations: async (src: User) => (await Repos.Users.fetchUserAccounts(src.id!)).map(async oid => await FDB.Organization.findById(oid)),
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
    }
};