import { UpdateSettingsChanged } from './../openland-module-db/store';
import { Store } from './../openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import NotificationPreviewRoot = GQLRoots.NotificationPreviewRoot;
import SubscriptionWatchSettingsArgs = GQL.SubscriptionWatchSettingsArgs;
import SubscriptionSettingsWatchArgs = GQL.SubscriptionSettingsWatchArgs;
import { fastWatch } from '../openland-module-db/fastWatch';
import { Context } from '@openland/context';
import { OptionalNullable } from '../openland-module-api/schema/SchemaUtils';
import UpdateSettingsInput = GQL.UpdateSettingsInput;
import { UserSettingsSnapshot } from './UsersModule';

const settingsUpdateResolver = async (parent: Context, args: { settings: OptionalNullable<UpdateSettingsInput>, uid?: string }, uid: number) => {
    return await inTx(parent, async (ctx) => {
        let _uid = uid;
        if (args.uid && ((await Modules.Super.superRole(ctx, uid)) === 'super-admin')) {
            _uid = IDs.User.parse(args.uid);
        }
        let settings = await Modules.Users.getUserSettingsEntity(ctx, _uid);
        if (!args.settings) {
            return await Modules.Users.getUserSettings(ctx, uid);
        }
        if (args.settings.emailFrequency) {
            settings.emailFrequency = args.settings.emailFrequency as any;
        }
        if (args.settings.desktopNotifications) {
            settings.desktopNotifications = args.settings.desktopNotifications as any;
            if (settings.desktop) {
                let desktopChatNotificationEnabled = settings.desktopNotifications === 'all';
                let desktopDirectNotificationEnabled = settings.desktopNotifications === 'all' || settings.desktopNotifications === 'direct';
                settings.desktop = {
                    ...settings.desktop,
                    direct: {
                        showNotification: desktopDirectNotificationEnabled,
                        sound: desktopDirectNotificationEnabled,
                    },
                    communityChat: {
                        showNotification: desktopChatNotificationEnabled,
                        sound: desktopChatNotificationEnabled
                    },
                    organizationChat: {
                        showNotification: desktopChatNotificationEnabled,
                        sound: desktopChatNotificationEnabled
                    },
                    secretChat: {
                        showNotification: desktopChatNotificationEnabled,
                        sound: desktopChatNotificationEnabled
                    }
                };
            }
        }
        if (args.settings.mobileNotifications) {
            settings.mobileNotifications = args.settings.mobileNotifications as any;
            if (settings.mobile) {
                let mobileAlertDirect = settings.mobileNotifications === 'all' || settings.mobileNotifications === 'direct';
                let mobileAlertChat = settings.mobileNotifications === 'all';
                let mobileChatNotificationEnabled = !!settings.mobileAlert && mobileAlertChat;
                let mobileDirectNotificationEnabled = !!settings.mobileAlert && mobileAlertDirect;
                settings.mobile = {
                    ...settings.mobile,
                    direct: {
                        showNotification: mobileDirectNotificationEnabled,
                        sound: mobileAlertDirect,
                    },
                    communityChat: {
                        showNotification: mobileChatNotificationEnabled,
                        sound: mobileAlertChat
                    },
                    organizationChat: {
                        showNotification: mobileChatNotificationEnabled,
                        sound: mobileAlertChat
                    },
                    secretChat: {
                        showNotification: mobileChatNotificationEnabled,
                        sound: mobileAlertChat
                    }
                };
            }
        }
        if (args.settings.mobileAlert !== null && args.settings.mobileAlert !== undefined) {
            settings.mobileAlert = args.settings.mobileAlert as any;
            if (settings.mobile) {
                let mobileAlertDirect = settings.mobileNotifications === 'all' || settings.mobileNotifications === 'direct';
                let mobileAlertChat = settings.mobileNotifications === 'all';
                let mobileChatNotificationEnabled = !!settings.mobileAlert && mobileAlertChat;
                let mobileDirectNotificationEnabled = !!settings.mobileAlert && mobileAlertDirect;
                settings.mobile = {
                    ...settings.mobile,
                    direct: {
                        showNotification: mobileDirectNotificationEnabled,
                        sound: mobileAlertDirect,
                    },
                    communityChat: {
                        showNotification: mobileChatNotificationEnabled,
                        sound: mobileAlertChat
                    },
                    organizationChat: {
                        showNotification: mobileChatNotificationEnabled,
                        sound: mobileAlertChat
                    },
                    secretChat: {
                        showNotification: mobileChatNotificationEnabled,
                        sound: mobileAlertChat
                    }
                };
            }
        }
        if (args.settings.mobileIncludeText !== null && args.settings.mobileIncludeText !== undefined) {
            settings.mobileIncludeText = args.settings.mobileIncludeText as any;
            if (settings.mobile) {
                settings.mobile.notificationPreview = settings.mobileIncludeText ? 'name_text' : 'name';
            }
        }
        if (args.settings.notificationsDelay !== null && args.settings.notificationsDelay !== undefined) {
            settings.notificationsDelay = args.settings.notificationsDelay as any;
        }
        if (args.settings.commentNotifications && args.settings.commentNotifications !== null) {
            settings.commentNotifications = args.settings.commentNotifications as any;
        }

        if (args.settings.commentNotificationsDelivery && args.settings.commentNotificationsDelivery !== null) {
            settings.commentNotificationsDelivery = args.settings.commentNotificationsDelivery as any;
            if (settings.desktop) {
                settings.desktop.comments = {
                    sound: settings.commentNotificationsDelivery !== 'none',
                    showNotification: settings.commentNotificationsDelivery !== 'none',
                };
            }
            if (settings.mobile) {
                settings.mobile.comments = {
                    sound: settings.commentNotificationsDelivery !== 'none',
                    showNotification: settings.commentNotificationsDelivery !== 'none',
                };
            }
        }

        if (!settings.privacy) {
            settings.privacy = {
                whoCanSeePhone: 'nobody',
                whoCanSeeEmail: 'nobody',
                communityAdminsCanSeeContactInfo: true,
                whoCanAddToGroups: 'everyone'
            };
        }
        if (args.settings.whoCanSeeEmail) {
            settings.privacy.whoCanSeeEmail = args.settings.whoCanSeeEmail === 'EVERYONE' ? 'everyone' : 'nobody';
        }
        if (args.settings.whoCanSeePhone) {
            settings.privacy.whoCanSeePhone = args.settings.whoCanSeePhone === 'EVERYONE' ? 'everyone' : 'nobody';
        }
        if (args.settings.communityAdminsCanSeeContactInfo !== null) {
            settings.privacy.communityAdminsCanSeeContactInfo = args.settings.communityAdminsCanSeeContactInfo;
        }
        if (args.settings.whoCanAddToGroups) {
            switch (args.settings.whoCanAddToGroups) {
                case 'NOBODY':
                    settings.privacy.whoCanAddToGroups = 'nobody';
                    break;
                case 'CORRESPONDENTS':
                    settings.privacy.whoCanAddToGroups = 'correspondents';
                    break;
                default: // EVERYONE (default)
                    settings.privacy.whoCanAddToGroups = 'everyone';
                    break;
            }
        }

        let countUnreadChats = !settings.globalCounterType ? false : (settings.globalCounterType === 'unread_chats' || settings.globalCounterType === 'unread_chats_no_muted');
        let excludeMutedChats = !settings.globalCounterType ? false : (settings.globalCounterType === 'unread_messages_no_muted' || settings.globalCounterType === 'unread_chats_no_muted');

        if (args.settings.countUnreadChats !== undefined && args.settings.countUnreadChats !== null) {
            countUnreadChats = args.settings.countUnreadChats;
        }
        if (args.settings.excludeMutedChats !== undefined && args.settings.excludeMutedChats !== null) {
            excludeMutedChats = args.settings.excludeMutedChats;
        }

        if (settings.desktop && args.settings.desktop) {
            let { desktop } = args.settings;
            if (desktop.comments) {
                settings.desktop.comments = desktop.comments;
            }
            if (desktop.communityChat) {
                settings.desktop.communityChat = desktop.communityChat;
            }
            if (desktop.direct) {
                settings.desktop.direct = desktop.direct;
            }
            if (desktop.organizationChat) {
                settings.desktop.organizationChat = desktop.organizationChat;
            }
            if (desktop.notificationPreview) {
                settings.desktop.notificationPreview = desktop.notificationPreview === 'NAME_TEXT' ? 'name_text' : 'name';
            }
            if (desktop.secretChat) {
                settings.desktop.secretChat = desktop.secretChat;
            }
            if (desktop.channels) {
                settings.desktop.channels = desktop.channels;
            }
        }
        if (settings.mobile && args.settings.mobile) {
            let { mobile } = args.settings;
            if (mobile.comments) {
                settings.mobile.comments = mobile.comments;
            }
            if (mobile.communityChat) {
                settings.mobile.communityChat = mobile.communityChat;
            }
            if (mobile.direct) {
                settings.mobile.direct = mobile.direct;
            }
            if (mobile.organizationChat) {
                settings.mobile.organizationChat = mobile.organizationChat;
            }
            if (mobile.notificationPreview) {
                settings.mobile.notificationPreview = mobile.notificationPreview === 'NAME_TEXT' ? 'name_text' : 'name';
            }
            if (mobile.secretChat) {
                settings.mobile.secretChat = mobile.secretChat;
            }
            if (mobile.channels) {
                settings.mobile.channels = mobile.channels;
            }
        }

        if (countUnreadChats) {
            settings.globalCounterType = excludeMutedChats ? 'unread_chats_no_muted' : 'unread_chats';
        } else {
            settings.globalCounterType = excludeMutedChats ? 'unread_messages_no_muted' : 'unread_messages';
        }

        settings.invalidate();
        await Modules.Messaging.onGlobalCounterTypeChanged(ctx, _uid);
        await Modules.Users.notifyUserSettingsChanged(ctx, uid);
        await Modules.Users.markForIndexing(ctx, uid);
        await Modules.Events.postToCommon(ctx, uid, UpdateSettingsChanged.create({ uid }));
        return await Modules.Users.getUserSettings(ctx, uid);
    });
};

export const Resolver: GQLResolver = {
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
    NotificationComments: {
        ALL: 'all',
        DIRECT: 'direct',
        NONE: 'none'
    },
    NotificationsDelay: {
        NONE: 'none',
        MIN_1: '1min',
        MIN_15: '15min'
    },
    CommentsNotificationDelivery: {
        ALL: 'all',
        NONE: 'none'
    },
    Settings: {
        id: src => IDs.Settings.serialize(src.id),
        version: src => src.version,
        primaryEmail: async (src: UserSettingsSnapshot, args: {}, ctx: Context) => (await Store.User.findById(ctx, src.id))!.email || '',
        emailFrequency: src => src.emailFrequency,
        desktopNotifications: src => src.desktopNotifications,
        mobileNotifications: src => src.mobileNotifications,
        commentNotifications: src => src.commentNotifications ? src.commentNotifications : 'none',
        commentNotificationsDelivery: src => src.commentNotificationsDelivery ? src.commentNotificationsDelivery : 'none',
        mobileAlert: src => src.mobileAlert !== null && src.mobileAlert !== undefined ? src.mobileAlert : true,
        mobileIncludeText: src => src.mobileIncludeText !== null && src.mobileAlert !== undefined ? src.mobileIncludeText : true,
        notificationsDelay: src => src.notificationsDelay || 'none',
        countUnreadChats: src => !src.globalCounterType ? false : (src.globalCounterType === 'unread_chats' || src.globalCounterType === 'unread_chats_no_muted'),
        excludeMutedChats: src => !src.globalCounterType ? false : (src.globalCounterType === 'unread_messages_no_muted' || src.globalCounterType === 'unread_chats_no_muted'),
        desktop: src => src.desktop,
        mobile: src => src.mobile,
        whoCanSeeEmail: src => {
            if (!src.privacy) {
                return 'NOBODY';
            }
            if (src.privacy.whoCanSeeEmail === 'everyone') {
                return 'EVERYONE';
            }
            return 'NOBODY';
        },
        whoCanSeePhone: src => {
            if (!src.privacy) {
                return 'NOBODY';
            }
            if (src.privacy.whoCanSeePhone === 'everyone') {
                return 'EVERYONE';
            }
            return 'NOBODY';
        },
        communityAdminsCanSeeContactInfo: src => {
            return src.privacy?.communityAdminsCanSeeContactInfo !== false;
        },
        whoCanAddToGroups: src => {
            if (!src.privacy) {
                return 'EVERYONE';
            }
            switch (src.privacy.whoCanAddToGroups) {
                case 'nobody':
                    return 'NOBODY';
                case 'correspondents':
                    return 'CORRESPONDENTS';
                default:
                    return 'EVERYONE';
            }
        }
    },
    PlatformNotificationSettings: {
        channels: src => src.channels ? src.channels : { showNotification: true, sound: true },
        notificationPreview: src => src.notificationPreview.toUpperCase() as NotificationPreviewRoot
    },
    Query: {
        settings: withUser(async (ctx, args, uid) => {
            return Modules.Users.getUserSettings(ctx, uid);
        }),
        authPoints: withUser(async (ctx, args, uid) => {
            let user = await Store.User.findById(ctx, uid);
            return {
                email: user?.email || null,
                phone: user?.phone || null
            };
        }),
    },
    SequenceCommon: {
        settings: withUser(async (ctx, args, uid) => {
            return Modules.Users.getUserSettings(ctx, uid);
        }),
    },
    Mutation: {
        settingsUpdate: withUser(async (parent, args: GQL.MutationUpdateSettingsArgs, uid: number) => {
            return settingsUpdateResolver(parent, args, uid);
        }),
        updateSettings: withUser(async (parent, args: GQL.MutationUpdateSettingsArgs, uid: number) => {
            return settingsUpdateResolver(parent, args, uid);
        }),

        sendEmailPairCode: withUser(async (parent, args, uid) => {
            return await Modules.Auth.authManagement.sendEmailPairCode(parent, uid, args.email);
        }),
        pairEmail: withUser(async (parent, args, uid) => {
            return await Modules.Auth.authManagement.pairEmail(parent, uid, args.sessionId, args.confirmationCode);
        }),

        sendPhonePairCode: withUser(async (parent, args, uid) => {
            return await Modules.Auth.authManagement.sendPhonePairCode(parent, uid, args.phone);
        }),
        pairPhone: withUser(async (parent, args, uid) => {
            return await Modules.Auth.authManagement.pairPhone(parent, uid, args.sessionId, args.confirmationCode);
        }),
        onLogOut: async (root, args, ctx) => {
            if (!ctx.auth.uid || !ctx.auth.tid) {
                return false;
            }
            await Modules.Auth.sessions.terminateSession(ctx, ctx.auth.uid, ctx.auth.tid);
            return true;
        },
    },
    Subscription: {
        watchSettings: {
            resolve: async (uid: any, args: SubscriptionWatchSettingsArgs, ctx: Context) => {
                return await Modules.Users.getUserSettings(ctx, uid);
            },
            subscribe: async function* (_: any, args: SubscriptionWatchSettingsArgs, parent: Context) {
                if (!parent.auth.uid) {
                    throw new AccessDeniedError();
                }

                let version = await inTx(parent, async (ctx) => {
                    return (await Modules.Users.getUserSettingsEntity(ctx, ctx.auth.uid!)).metadata.versionCode;
                });
                yield parent.auth.uid;

                while (true) {
                    let changed = await fastWatch(parent, 'user-settings-' + parent.auth.uid, version,
                        async (ctx) => (await inTx(ctx, (ctx2) => Modules.Users.getUserSettingsEntity(ctx2, parent.auth.uid!)))!.metadata.versionCode
                    );
                    if (changed.result) {
                        version = changed.version;
                        yield parent.auth.uid as any;
                    } else {
                        break;
                    }
                }

                return;
            }
        },
        settingsWatch: {
            resolve: async (uid: any, args: SubscriptionSettingsWatchArgs, ctx: Context) => {
                return await Modules.Users.getUserSettings(ctx, uid);
            },
            subscribe: async function* (_: any, args: SubscriptionSettingsWatchArgs, parent: Context) {
                if (!parent.auth.uid) {
                    throw new AccessDeniedError();
                }

                let version = await inTx(parent, async (ctx) => {
                    return (await Modules.Users.getUserSettingsEntity(ctx, ctx.auth.uid!)).metadata.versionCode;
                });
                yield parent.auth.uid as any;

                while (true) {
                    let changed = await fastWatch(parent, 'user-settings-' + parent.auth.uid, version,
                        async (ctx) => (await inTx(ctx, (ctx2) => Modules.Users.getUserSettingsEntity(ctx2, parent.auth.uid!)))!.metadata.versionCode
                    );
                    if (changed.result) {
                        version = changed.version;
                        yield parent.auth.uid as any;
                    } else {
                        break;
                    }
                }

                return;
            }
        }
    }
};
