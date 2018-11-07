import DataLoader from 'dataloader';
import { User, UserProfile } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { CallContext } from 'openland-server/api/utils/CallContext';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { FDB } from 'openland-module-db/FDB';
import { IDs } from 'openland-server/api/utils/IDs';
import { withAny } from 'openland-server/api/utils/Resolvers';

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

async function loadPrimatyOrganization(profile: UserProfile | null, src: User) {
    let orgId = (profile && profile.primaryOrganization) || (await Modules.Orgs.findUserOrganizations(src.id))[0];
    return orgId ? FDB.Organization.findById(orgId) : undefined;
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
        isBot: (src: User) => src.isBot || false,
        isYou: (src: User, args: {}, context: CallContext) => src.id === context.uid,
        
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

        primaryOrganization: withProfile(async (src, profile) => loadPrimatyOrganization(profile, src)),

        organizations: async (src: User) => (await Modules.Orgs.findUserOrganizations(src.id!)).map(async oid => await FDB.Organization.findById(oid)),
        online: async (src: User) => await Modules.Presence.getLastSeen(src.id) === 'online',
        lastSeen: async (src: User) => Modules.Presence.getLastSeen(src.id), // await Repos.Users.getUserLastSeen(src.id!),

        shortname: async (src: User) => {
            let shortname = await Modules.Shortnames.findUserShortname(src.id);
            if (shortname) {
                return shortname.shortname;
            }
            return null;
        },

        // Deprecated
        picture: withProfile((src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null),
        pictureRef: withProfile((src, profile) => profile && profile.picture),
        alphaRole: withProfile((src, profile) => profile && profile.role),
        alphaLinkedin: withProfile((src, profile) => profile && profile.linkedin),
        alphaTwitter: withProfile((src, profile) => profile && profile.twitter),

        alphaPrimaryOrganization: withProfile(async (src, profile) => loadPrimatyOrganization(profile, src)),
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
};