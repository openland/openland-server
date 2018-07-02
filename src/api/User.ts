import { DB, User } from '../tables';
import { CallContext } from './utils/CallContext';
import { IDs } from './utils/IDs';
import { UserProfile } from '../tables/UserProfile';
import DataLoader from 'dataloader';
import { buildBaseImageUrl, ImageRef } from '../repositories/Media';
import { withUser } from './utils/Resolvers';
import { Sanitizer } from '../modules/Sanitizer';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';

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

        email: withProfile((src, profile) => profile ? profile.email : null),
        phone: withProfile((src, profile) => profile ? profile.phone : null),
        about: withProfile((src, profile) => profile ? profile.about : null),
        website: withProfile((src, profile) => profile ? profile.website : null),
        location: withProfile((src, profile) => profile ? profile.location : null),

        isCreated: withProfile((src, profile) => !!profile),
        isYou: (src: User, args: {}, context: CallContext) => src.id === context.uid
    },
    Profile: {
        id: (src: UserProfile) => IDs.Profile.serialize(src.id!!),
        firstName: (src: UserProfile) => src.firstName,
        lastName: (src: UserProfile) => src.lastName,
        photoRef: (src: UserProfile) => src.picture,
        email: (src: UserProfile) => src.email,
        phone: (src: UserProfile) => src.phone,
        website: (src: UserProfile) => src.website,
        about: (src: UserProfile) => src.about,
        location: (src: UserProfile) => src.location,
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
        },
        myProfile: async function (_obj: any, _params: {}, context: CallContext) {
            if (context.uid == null) {
                return null;
            }
            return DB.UserProfile.find({
                where: {
                    userId: context.uid
                }
            });
        },
        myProfilePrefill: async function (_: any, args: {}, context: CallContext) {
            if (!context.uid) {
                return {};
            }
            let prefill = await DB.UserProfilePrefill.find({ where: { userId: context.uid } });
            if (prefill) {
                return {
                    firstName: prefill.firstName,
                    lastName: prefill.lastName,
                    picture: prefill.picture
                };
            } else {
                return {};
            }
        },
    },
    Mutation: {
        createProfile: withUser<{
            input: {
                firstName: string,
                lastName?: string | null,
                photoRef?: ImageRef | null,
                phone?: string | null,
                email?: string | null,
                website?: string | null,
                about?: string | null,
                location?: string | null
            }
        }>(async (args, uid) => {
            return await DB.tx(async (tx) => {
                let user = await DB.User.findById(uid, { transaction: tx });
                if (!user) {
                    throw Error('Unable to find user');
                }

                // Do not create profile if already exists
                let existing = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx, lock: tx.LOCK.UPDATE });
                if (existing) {
                    return existing;
                }
                
                await validate(
                    stringNotEmpty('First name can\'t be empty!'),
                    args.input.firstName,
                    'input.firstName'
                );

                // Create pfofile
                await DB.UserProfile.create({
                    userId: uid,
                    firstName: Sanitizer.sanitizeString(args.input.firstName)!,
                    lastName: Sanitizer.sanitizeString(args.input.lastName),
                    picture: Sanitizer.sanitizeImageRef(args.input.photoRef),
                    phone: Sanitizer.sanitizeString(args.input.phone),
                    email: Sanitizer.sanitizeString(args.input.email) || user.email,
                    website: Sanitizer.sanitizeString(args.input.website),
                    about: Sanitizer.sanitizeString(args.input.about),
                    location: Sanitizer.sanitizeString(args.input.location)
                }, { transaction: tx });

                return user;
            });
        }),
        updateProfile: withUser<{
            input: {
                firstName?: string | null,
                lastName?: string | null,
                photoRef?: ImageRef | null,
                phone?: string | null,
                email?: string | null,
                website?: string | null,
                about?: string | null,
                location?: string | null
            }
        }>(async (args, uid) => {
            return await DB.tx(async (tx) => {
                let user = await DB.User.findById(uid, { transaction: tx });
                if (!user) {
                    throw Error('Unable to find user');
                }
                let profile = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx, lock: tx.LOCK.UPDATE });
                if (!profile) {
                    throw Error('Unable to find profile');
                }
                if (args.input.firstName !== undefined) {
                    await validate(
                        stringNotEmpty('First name can\'t be empty!'),
                        args.input.firstName,
                        'input.firstName'
                    );
                    profile.firstName =  Sanitizer.sanitizeString(args.input.firstName)!;
                }
                if (args.input.lastName !== undefined) {
                    profile.lastName = Sanitizer.sanitizeString(args.input.lastName);
                }
                if (args.input.location !== undefined) {
                    profile.location = Sanitizer.sanitizeString(args.input.location);
                }
                if (args.input.website !== undefined) {
                    profile.website = Sanitizer.sanitizeString(args.input.website);
                }
                if (args.input.about !== undefined) {
                    profile.about = Sanitizer.sanitizeString(args.input.about);
                }
                if (args.input.photoRef !== undefined) {
                    profile.picture = args.input.photoRef;
                }
                if (args.input.phone !== undefined) {
                    profile.phone = Sanitizer.sanitizeString(args.input.phone);
                }
                if (args.input.email !== undefined) {
                    profile.email = Sanitizer.sanitizeString(args.input.email);
                }
                await profile.save({ transaction: tx });
                return user;
            });
        })
    }
};