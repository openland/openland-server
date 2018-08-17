import { DB, User } from '../tables';
import { CallContext } from './utils/CallContext';
import { IDs } from './utils/IDs';
import { UserProfile } from '../tables/UserProfile';
import DataLoader from 'dataloader';
import { buildBaseImageUrl, ImageRef } from '../repositories/Media';
import { withUser, withAny } from './utils/Resolvers';
import { Sanitizer } from '../modules/Sanitizer';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { Repos } from '../repositories';
import { UserSettings } from '../tables/UserSettings';
import { UserExtras } from '../repositories/UserExtras';

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
    EmailFrequency: {
        NEVER: 'never',
        MIN_15: '15min',
        HOUR_1: '1hour'
    },
    NotificationMessages: {
        ALL: 'all',
        DIRECT: 'direct',
        NONE: 'none'
    },
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
        alphaLinkedin: withProfile((src, profile) => profile && profile.extras && profile.extras.linkedin),
        alphaTwitter: withProfile((src, profile) => profile && profile.extras && profile.extras.twitter),
        location: withProfile((src, profile) => profile ? profile.location : null),

        isCreated: withProfile((src, profile) => !!profile),
        isBot: (src: User) => src.isBot || false,
        isYou: (src: User, args: {}, context: CallContext) => src.id === context.uid,
        alphaPrimaryOrganization: (src: User) => Repos.Users.resolvePrimaryOrganization(src.id!!),
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
        alphaRole: (src: UserProfile) => src.extras && src.extras.role,
        alphaLocations: (src: UserProfile) => src.extras && src.extras.locations,
        alphaLinkedin: (src: UserProfile) => src.extras && src.extras.linkedin,
        alphaTwitter: (src: UserProfile) => src.extras && src.extras.twitter,
        alphaPrimaryOrganizationId: (src: UserProfile) => src.extras && src.extras.primaryOrganizationId,
        alphaPrimaryOrganization: (src: UserProfile) => Repos.Users.resolvePrimaryOrganization(src.userId!!),
        alphaJoinedAt: (src: UserProfile) => (src as any).createdAt,
        alphaInvitedBy: async (src: UserProfile) => await Repos.Users.getUserInvitedBy(src.userId!!),
    },
    Settings: {
        id: (src: UserSettings) => IDs.Settings.serialize(src.id),
        primaryEmail: async (src: UserSettings) => (await DB.User.findById(src.userId))!!.email,
        emailFrequency: (src: UserSettings) => Repos.Users.getUserSettingsFromInstance(src).emailFrequency,
        desktopNotifications: (src: UserSettings) => Repos.Users.getUserSettingsFromInstance(src).desktopNotifications,
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
        settings: withUser(async (args, uid) => {
            return await DB.tx(async (tx) => {
                let instance = await DB.UserSettings.find({ where: { userId: uid }, transaction: tx, lock: 'UPDATE' });
                if (!instance) {
                    instance = await DB.UserSettings.create({ userId: uid }, { transaction: tx });
                }
                return instance;
            });
        }),
        user: withAny<{ id: string }>((args) => {
            return DB.User.findById(IDs.User.parse(args.id));
        })
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
                return await Repos.Users.createUser(uid, args.input, tx);
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
                location?: string | null,
                alphaLocations?: string[] | null,
                alphaLinkedin?: string | null,
                alphaTwitter?: string | null,
                alphaRole?: string | null,
                alphaPrimaryOrganizationId?: string,
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
                    profile.firstName = Sanitizer.sanitizeString(args.input.firstName)!;
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

                let extras: UserExtras = profile.extras || {};

                if (args.input.alphaLocations !== undefined) {
                    extras.locations = Sanitizer.sanitizeAny(args.input.alphaLocations);
                }

                if (args.input.alphaLinkedin !== undefined) {
                    extras.linkedin = Sanitizer.sanitizeString(args.input.alphaLinkedin);
                }

                if (args.input.alphaTwitter !== undefined) {
                    extras.twitter = Sanitizer.sanitizeString(args.input.alphaTwitter);
                }

                if (args.input.alphaRole !== undefined) {
                    extras.role = Sanitizer.sanitizeString(args.input.alphaRole);
                }

                if (args.input.alphaPrimaryOrganizationId !== undefined) {
                    extras.primaryOrganization = IDs.Organization.parse(args.input.alphaPrimaryOrganizationId);
                }

                profile.extras = extras;

                await profile.save({ transaction: tx });
                return user;
            });
        }),
        alphaReportOnline: async (_: any, args: { timeout: number }, context: CallContext) => {
            if (!context.uid) {
                throw Error('Not authorized');
            }
            if (args.timeout <= 0) {
                throw Error('Invalid input');
            }
            if (args.timeout > 5000) {
                throw Error('Invalid input');
            }
            await Repos.Users.markUserOnline(context.uid, args.timeout, context.tid!!);
            return 'ok';
        },
        updateSettings: withUser<{ settings: { emailFrequency?: string | null, desktopNotifications?: string | null } }>(async (args, uid) => {
            return await DB.tx(async (tx) => {
                let settings = await DB.UserSettings.find({ where: { userId: uid }, transaction: tx, lock: 'UPDATE' });
                if (!settings) {
                    settings = await DB.UserSettings.create({ userId: uid }, { transaction: tx });
                }
                if (args.settings.emailFrequency) {
                    settings.settings = {
                        ...settings.settings,
                        emailFrequency: args.settings.emailFrequency
                    };
                }
                if (args.settings.desktopNotifications) {
                    settings.settings = {
                        ...settings.settings,
                        desktopNotifications: args.settings.desktopNotifications
                    };
                }
                await settings.save({ transaction: tx });
                return settings;
            });
        })
    },
    Subscription: {
        watchSettings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: any, context: CallContext) {
                let ended = false;
                return {
                    ...(async function* func() {
                        while (!ended) {
                            let settings = await DB.tx(async (tx) => {
                                let st = await DB.UserSettings.find({ where: { userId: context.uid }, transaction: tx, lock: 'UPDATE' });
                                if (!st) {
                                    st = await DB.UserSettings.create({ userId: context.uid }, { transaction: tx });
                                }
                                return st;
                            });
                            yield settings;
                            await Repos.Users.settingsReader.loadNext(context.uid!!);
                        }
                    })(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        }
    }
};