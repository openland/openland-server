import { DB, User } from '../tables';
import { CallContext } from './utils/CallContext';
import { IDs } from './utils/IDs';
import { UserProfile } from '../tables/UserProfile';
import * as DataLoader from 'dataloader';
import { buildBaseImageUrl, ImageRef } from '../repositories/Media';
import { withUser } from './utils/Resolvers';
import { UserError } from '../errors/UserError';
import { Sanitizer } from '../modules/Sanitizer';

function userLoader(context: CallContext) {
    if (!context.cache.has('__profile_loader')) {
        context.cache.set('__profile_loader', new DataLoader<number, UserProfile | null>(async (ids) => {
            let foundTokens = await DB.UserProfile.findAll({
                where: {
                    userId: {
                        $in: ids
                    }
                }
            });

            let res: (UserProfile | null)[] = [];
            for (let i of ids) {
                let found = false;
                for (let f of foundTokens) {
                    if (i === f.userId) {
                        res.push(f);
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

function withProfile(handler: (user: User, profile: UserProfile | null) => any) {
    return async (src: User, _params: {}, context: CallContext) => {
        let loader = userLoader(context);
        let profile = await loader.load(src.id!!);
        return handler(src, profile);
    };
}

export const Resolver = {
    User: {
        id: (src: User) => IDs.User.serialize(src.id!!),
        name: withProfile((src, profile) => profile ? [profile.firstName, profile.lastName].filter((v) => !!v).join(' ') : src.email),
        firstName: withProfile((src, profile) => profile ? profile.firstName : src.email),
        lastName: withProfile((src, profile) => profile ? profile.lastName : null),

        picture: withProfile((src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null),
        pictureRef: withProfile((src, profile) => profile && profile.picture),
        photo: withProfile((src, profile) => profile && profile.picture ? buildBaseImageUrl(profile.picture) : null),
        photoRef: withProfile((src, profile) => profile && profile.picture),

        email: (src: User) => src.email,
        phone: withProfile((src, profile) => profile ? profile.phone : null),
        about: withProfile((src, profile) => profile ? profile.about : null),
        website: withProfile((src, profile) => profile ? profile.website : null),
        location: withProfile((src, profile) => profile ? profile.location : null),

        isCreated: withProfile((src, profile) => !!profile),
        isYou: (src: User, args: {}, context: CallContext) => src.id === context.uid
    },
    Query: {
        me: async function (_obj: any, _params: {}, context: CallContext) {
            if (context.uid == null) {
                return null;
            } else {
                let profile = await userLoader(context).load(context.uid);
                if (profile === null) {
                    return null;
                }
                return DB.User.findById(context.uid);
            }
        }
    },
    Mutation: {
        updateProfile: withUser<{
            input: {
                firstName?: string | null,
                lastName?: string | null,
                photoRef?: ImageRef | null,
                website?: string | null,
                about?: string | null,
                location?: string | null
            }
        }>(async (args, uid) => {
            return await DB.tx(async (tx) => {
                let user = await DB.User.findById(uid);
                if (!user) {
                    throw Error('Unable to find user');
                }
                let profile = await DB.UserProfile.find({ where: { userId: uid } });
                if (!profile) {
                    throw Error('Unable to find profile');
                }
                if (args.input.firstName !== undefined) {
                    let firstName = Sanitizer.sanitizeString(args.input.firstName);
                    if (!firstName) {
                        throw new UserError('First name can\'t be empty!');
                    }
                    profile.firstName = firstName;
                }
                if (args.input.lastName !== undefined) {
                    let lastName = Sanitizer.sanitizeString(args.input.lastName);
                    profile.lastName = lastName;
                }
                if (args.input.location !== undefined) {
                    let location = Sanitizer.sanitizeString(args.input.location);
                    profile.location = location;
                }
                if (args.input.website !== undefined) {
                    let website = Sanitizer.sanitizeString(args.input.website);
                    profile.website = website;
                }
                if (args.input.about !== undefined) {
                    let about = Sanitizer.sanitizeString(args.input.about);
                    profile.about = about;
                }
                if (args.input.photoRef !== undefined) {
                    profile.picture = args.input.photoRef;
                }
                await profile.save();
                return user;
            });
        })
    }
};