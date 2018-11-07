import { CallContext } from './utils/CallContext';
import { IDs } from './utils/IDs';
import DataLoader from 'dataloader';
import { withUser, withAny } from './utils/Resolvers';
import { Sanitizer } from '../modules/Sanitizer';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { Repos } from '../repositories';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { Modules } from 'openland-modules/Modules';
import { UserProfile, UserSettings, User } from 'openland-module-db/schema';
import { UserError } from 'openland-server/errors/UserError';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { buildBaseImageUrl, ImageRef } from 'openland-module-media/ImageRef';

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
        alphaRole: (src: UserProfile) => src.role,
        alphaLocations: (src: UserProfile) => src.locations,
        alphaLinkedin: (src: UserProfile) => src.linkedin,
        alphaTwitter: (src: UserProfile) => src.twitter,
        alphaPrimaryOrganizationId: (src: UserProfile) => src.primaryOrganization ? IDs.Organization.serialize(src.primaryOrganization) : null,
        alphaPrimaryOrganization: async (src: UserProfile) => await FDB.Organization.findById(src.primaryOrganization || (await Repos.Users.fetchUserAccounts(src.id))[0]),
        alphaJoinedAt: (src: UserProfile) => src.createdAt,
        alphaInvitedBy: async (src: UserProfile) => await Repos.Users.getUserInvitedBy(src.id),
    },
    Settings: {
        id: (src: UserSettings) => IDs.Settings.serialize(src.id),
        primaryEmail: async (src: UserSettings) => (await FDB.User.findById(src.id))!!.email,
        emailFrequency: (src: UserSettings) => src.emailFrequency,
        desktopNotifications: (src: UserSettings) => src.desktopNotifications,
        mobileNotifications: (src: UserSettings) => src.mobileNotifications,
        mobileAlert: (src: UserSettings) => src.mobileAlert !== null && src.mobileAlert !== undefined ? src.mobileAlert : true,
        mobileIncludeText: (src: UserSettings) => src.mobileIncludeText !== null && src.mobileAlert !== undefined ? src.mobileIncludeText : true,
        notificationsDelay: (src: UserSettings) => src.notificationsDelay,
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

                return FDB.User.findById(context.uid);
            }
        },
        myProfile: async function (_obj: any, _params: {}, context: CallContext) {
            if (context.uid == null) {
                return null;
            }
            return Modules.Users.profileById(context.uid);
        },
        myProfilePrefill: async function (_: any, args: {}, context: CallContext) {
            if (!context.uid) {
                return {};
            }
            let prefill = await Modules.Users.findProfilePrefill(context.uid);
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
            return Modules.Users.getUserSettings(uid);
        }),
        user: withAny<{ id: string }>((args) => {
            return FDB.User.findById(IDs.User.parse(args.id));
        }),
        alphaProfiles: withAny<{ query: string, first: number, after: string, page: number, sort?: string }>(async (args) => {

            let uids = await Modules.Users.searchForUsers(args.query);

            if (uids.length === 0) {
                return [];
            }

            // Fetch profiles
            let users = uids.map((v) => FDB.User.findById(v));

            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }
            let total = users.length;

            return {
                edges: users.map((p, i) => {
                    return {
                        node: p,
                        cursor: (i + 1 + offset).toString()
                    };
                }),
                pageInfo: {
                    hasNextPage: (total - (offset + 1)) >= args.first, // ids.length === this.limitValue,
                    hasPreviousPage: false,

                    itemsCount: total,
                    pagesCount: Math.min(Math.floor(8000 / args.first), Math.ceil(total / args.first)),
                    currentPage: Math.floor(offset / args.first) + 1,
                    openEnded: true
                },
            };
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
            return await Repos.Users.createUser(uid, args.input);
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
            return await inTx(async () => {
                if (args.uid) {
                    let role = await Repos.Permissions.superRole(uid);
                    if (!(role === 'super-admin')) {
                        throw new AccessDeniedError();
                    }
                    uid = IDs.User.parse(args.uid);
                }
                let user = await FDB.User.findById(uid);
                if (!user) {
                    throw Error('Unable to find user');
                }
                await inTx(async () => {
                    let profile = await Modules.Users.profileById(uid);
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
                            await Modules.Media.saveFile(args.input.photoRef.uuid);
                        }
                        profile.picture = Sanitizer.sanitizeImageRef(args.input.photoRef);
                    }
                    if (args.input.phone !== undefined) {
                        profile.phone = Sanitizer.sanitizeString(args.input.phone);
                    }
                    if (args.input.email !== undefined) {
                        profile.email = Sanitizer.sanitizeString(args.input.email);
                    }

                    if (args.input.alphaLocations !== undefined) {
                        profile.locations = Sanitizer.sanitizeAny(args.input.alphaLocations);
                    }

                    if (args.input.alphaLinkedin !== undefined) {
                        profile.linkedin = Sanitizer.sanitizeString(args.input.alphaLinkedin);
                    }

                    if (args.input.alphaTwitter !== undefined) {
                        profile.twitter = Sanitizer.sanitizeString(args.input.alphaTwitter);
                    }

                    if (args.input.alphaRole !== undefined) {
                        profile.role = Sanitizer.sanitizeString(args.input.alphaRole);
                    }

                    if (args.input.alphaPrimaryOrganizationId !== undefined) {
                        profile.primaryOrganization = IDs.Organization.parse(args.input.alphaPrimaryOrganizationId);
                    }
                });
                return user;
            });
        }),
        alphaDeleteProfile: withUser<{}>(async (args, uid) => {
            // await DB.UserProfile.destroy({ where: { id: uid } });

            // return 'ok';
            throw new UserError('This feature is unusupported');
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

            // FIXME
            // let token = await DB.UserToken.findById(context.tid);
            // token!.lastIp = context.ip;
            // await token!.save();

            // await Repos.Users.markUserOnline(context.uid, args.timeout, context.tid!!, args.platform);
            await Modules.Presence.setOnline(context.uid, context.tid!, args.timeout, args.platform || 'unknown');
            // await Repos.Users.markUserActive(context.uid, args.timeout, context.tid!!, args.platform);
            return 'ok';
        },
        alphaReportOffline: withAny<{ platform?: string }>(async (args, ctx) => {
            // await Repos.Users.markUserOffline(ctx.uid!, ctx.tid!!, args.platform);
            // await Repos.Chats.onlineEngine.setOffline(ctx.uid!);
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

            // FIXME
            // let token = await DB.UserToken.findById(context.tid);
            // token!.lastIp = context.ip;
            // await token!.save();

            // await Repos.Users.markUserActive(context.uid, args.timeout, context.tid!!, args.platform);
            return 'ok';
        },
        updateSettings: withUser<{ settings: { emailFrequency?: string | null, desktopNotifications?: string | null, mobileNotifications?: string | null, mobileAlert?: boolean | null, mobileIncludeText?: boolean | null, notificationsDelay?: boolean | null } }>(async (args, uid) => {
            return await inTx(async () => {
                let settings = await Modules.Users.getUserSettings(uid);
                if (args.settings.emailFrequency) {
                    settings.emailFrequency = args.settings.emailFrequency as any;
                }
                if (args.settings.desktopNotifications) {
                    settings.desktopNotifications = args.settings.desktopNotifications as any;
                }
                if (args.settings.mobileNotifications) {
                    settings.mobileNotifications = args.settings.mobileNotifications as any;
                }
                if (args.settings.mobileAlert !== null) {
                    settings.mobileAlert = args.settings.mobileAlert as any;
                }
                if (args.settings.mobileIncludeText !== null) {
                    settings.mobileIncludeText = args.settings.mobileIncludeText as any;
                }
                if (args.settings.notificationsDelay !== null) {
                    settings.notificationsDelay = args.settings.notificationsDelay as any;
                }
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
                            let settings = await Modules.Users.getUserSettings(context.uid!!);
                            yield settings;
                            await Modules.Users.waitForNextSettings(context.uid!);
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