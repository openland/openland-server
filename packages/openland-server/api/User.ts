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
import { Services } from '../services';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { QueryParser } from '../modules/QueryParser';
import { ElasticClient } from '../indexing';
import { SelectBuilder } from '../modules/SelectBuilder';
import { Sources } from 'openland-server/sources/Sources';

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
        HOUR_1: '1hour',
        HOUR_24: '24hour',
        WEEK_1: '1week',
    },
    NotificationMessages: {
        ALL: 'all',
        DIRECT: 'direct',
        NONE: 'none'
    },
    NotificationsDelay: {
        NONE: 'none',
        MIN_1: '1min',
        MIN_15: '15min'
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
        alphaRole: withProfile((src, profile) => profile && profile.extras && profile.extras.role),
        alphaLinkedin: withProfile((src, profile) => profile && profile.extras && profile.extras.linkedin),
        alphaTwitter: withProfile((src, profile) => profile && profile.extras && profile.extras.twitter),
        location: withProfile((src, profile) => profile ? profile.location : null),

        isCreated: withProfile((src, profile) => !!profile),
        isBot: (src: User) => src.isBot || false,
        isYou: (src: User, args: {}, context: CallContext) => src.id === context.uid,
        alphaPrimaryOrganization: withProfile(async (src, profile) => await DB.Organization.findById((profile && profile.primaryOrganization) || (await Repos.Users.fetchUserAccounts(src.id!))[0])),
        online: async (src: User) => await Repos.Users.isUserOnline(src.id!),
        lastSeen: async (src: User) => Sources.Online.getLastSeen(src.id!), // await Repos.Users.getUserLastSeen(src.id!),
        createdChannels: async (src: User) => {
            return DB.Conversation.findAll({
                where: {
                    extras: {
                        creatorId: src.id
                    }
                }
            });
        },
        channelsJoined: async (src: User) => {
            return DB.txStable(async (tx) => {
                let memberships = await DB.ConversationGroupMembers.findAll({
                    where: {
                        userId: src.id
                    },
                    transaction: tx
                });

                let chats = await DB.Conversation.findAll({
                    where: {
                        id: { $in: memberships.map(m => m.conversationId) },
                        type: 'channel'
                    },
                    transaction: tx
                });

                return chats;
            });
        },
        shortname: async (src: User) => {
            let shortName = await DB.ShortName.findOne({ where: { type: 'user', ownerId: src.id } });

            if (shortName) {
                return shortName.name;
            }

            return null;
        },
        phones: async (src: User) => {
            return Repos.Phones.getUserPhones(src.id!);
        },
        lastIP: async (src: User) => Repos.Users.getUserLastIp(src.id!),
        alphaConversationSettings: async (src: User, _: any, context: CallContext) => await Repos.Chats.getConversationSettings(context.uid!!, (await Repos.Chats.loadPrivateChat(context.uid!!, src.id!)).id)
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
        alphaPrimaryOrganization: async (src: UserProfile) => await DB.Organization.findById(src.primaryOrganization || (await Repos.Users.fetchUserAccounts(src.userId!))[0]),
        alphaJoinedAt: (src: UserProfile) => (src as any).createdAt,
        alphaInvitedBy: async (src: UserProfile) => await Repos.Users.getUserInvitedBy(src.userId!!),
    },
    Settings: {
        id: (src: UserSettings) => IDs.Settings.serialize(src.id),
        primaryEmail: async (src: UserSettings) => (await DB.User.findById(src.userId))!!.email,
        emailFrequency: (src: UserSettings) => Repos.Users.getUserSettingsFromInstance(src).emailFrequency,
        desktopNotifications: (src: UserSettings) => Repos.Users.getUserSettingsFromInstance(src).desktopNotifications,
        mobileNotifications: (src: UserSettings) => Repos.Users.getUserSettingsFromInstance(src).mobileNotifications,
        mobileAlert: (src: UserSettings) => Repos.Users.getUserSettingsFromInstance(src).mobileAlert,
        mobileIncludeText: (src: UserSettings) => Repos.Users.getUserSettingsFromInstance(src).mobileIncludeText,
        notificationsDelay: (src: UserSettings) => Repos.Users.getUserSettingsFromInstance(src).notificationsDelay,
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
        }),
        alphaProfiles: withAny<{ query: string, first: number, after: string, page: number, sort?: string }>(async (args) => {
            let clauses: any[] = [];
            let sort: any[] | undefined = undefined;

            if (args.query || args.sort) {
                let parser = new QueryParser();
                parser.registerText('firstName', 'firstName');
                parser.registerText('lastName', 'lastName');
                parser.registerText('shortName', 'shortName');
                parser.registerText('name', 'name');
                parser.registerText('createdAt', 'createdAt');
                parser.registerText('updatedAt', 'updatedAt');

                if (args.query) {
                    clauses.push({ match_phrase_prefix: { search: args.query } });
                }

                if (args.sort) {
                    sort = parser.parseSort(args.sort);
                }
            }

            let hits = await ElasticClient.search({
                index: 'user_profiles',
                type: 'user_profile',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : (args.page ? ((args.page - 1) * args.first) : 0),
                body: {
                    sort: sort,
                    query: { bool: { must: clauses } }
                }
            });

            hits.hits.hits = hits.hits.hits.map(v => ({ ...v, _id: (v._source as any).userId }));

            let builder = new SelectBuilder(DB.User)
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return await builder.findElastic(hits);
        }),
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
                let res = await Repos.Users.createUser(uid, args.input, tx);
                return res;
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
            },
            uid?: string
        }>(async (args, uid) => {
            return await DB.tx(async (tx) => {
                if (args.uid) {
                    let role = await Repos.Permissions.superRole(uid);
                    if (!(role === 'super-admin')) {
                        throw new AccessDeniedError();
                    }
                    uid = IDs.User.parse(args.uid);
                }
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
                    if (args.input.photoRef !== null) {
                        await Services.UploadCare.saveFile(args.input.photoRef.uuid);
                    }
                    profile.picture = Sanitizer.sanitizeImageRef(args.input.photoRef);
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
                    profile.primaryOrganization = IDs.Organization.parse(args.input.alphaPrimaryOrganizationId);
                }

                profile.extras = extras;

                await profile.save({ transaction: tx });
                return user;
            });
        }),
        alphaDeleteProfile: withUser<{}>(async (args, uid) => {
            await DB.UserProfile.destroy({ where: { id: uid } });

            return 'ok';
        }),
        alphaReportOnline: async (_: any, args: { timeout: number, platform?: string }, context: CallContext) => {
            if (!context.uid) {
                throw Error('Not authorized');
            }
            if (args.timeout <= 0) {
                throw Error('Invalid input');
            }
            if (args.timeout > 5000) {
                throw Error('Invalid input');
            }

            let token = await DB.UserToken.findById(context.tid);
            token!.lastIp = context.ip;
            await token!.save();

            // await Repos.Users.markUserOnline(context.uid, args.timeout, context.tid!!, args.platform);
            await Sources.Online.setOnline(context.uid, context.tid!, args.timeout, args.platform || 'unknown');
            // await Repos.Users.markUserActive(context.uid, args.timeout, context.tid!!, args.platform);
            await Repos.Chats.onlineEngine.setOnline(context.uid, args.timeout);
            return 'ok';
        },
        alphaReportOffline: withAny<{ platform?: string }>(async (args, ctx) => {
            await Repos.Users.markUserOffline(ctx.uid!, ctx.tid!!, args.platform);
            await Repos.Chats.onlineEngine.setOffline(ctx.uid!);
            return 'ok';
        }),
        alphaReportActive: async (_: any, args: { timeout: number, platform?: string }, context: CallContext) => {
            if (!context.uid) {
                throw Error('Not authorized');
            }
            if (args.timeout <= 0) {
                throw Error('Invalid input');
            }
            if (args.timeout > 5000) {
                throw Error('Invalid input');
            }

            let token = await DB.UserToken.findById(context.tid);
            token!.lastIp = context.ip;
            await token!.save();

            await Repos.Users.markUserActive(context.uid, args.timeout, context.tid!!, args.platform);
            return 'ok';
        },
        updateSettings: withUser<{ settings: { emailFrequency?: string | null, desktopNotifications?: string | null, mobileNotifications?: string | null, mobileAlert?: boolean | null, mobileIncludeText?: boolean | null, notificationsDelay?: boolean | null } }>(async (args, uid) => {
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
                if (args.settings.mobileNotifications) {
                    settings.settings = {
                        ...settings.settings,
                        mobileNotifications: args.settings.mobileNotifications
                    };
                }
                if (args.settings.mobileAlert !== null) {
                    settings.settings = {
                        ...settings.settings,
                        mobileAlert: args.settings.mobileAlert as boolean
                    };
                }
                if (args.settings.mobileAlert !== null) {
                    settings.settings = {
                        ...settings.settings,
                        mobileAlert: args.settings.mobileAlert as boolean
                    };
                }
                if (args.settings.mobileIncludeText !== null) {
                    settings.settings = {
                        ...settings.settings,
                        mobileIncludeText: args.settings.mobileIncludeText as boolean
                    };
                }
                if (args.settings.notificationsDelay) {
                    settings.settings = {
                        ...settings.settings,
                        notificationsDelay: args.settings.notificationsDelay
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