import { Store } from './../openland-module-db/FDB';
import { UserSettings } from 'openland-module-db/store';
import { IDs } from 'openland-module-api/IDs';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

const updateSettingsResolver = withUser(async (parent, args: GQL.MutationSettingsUpdateArgs, uid: number) => {
    return await inTx(parent, async (ctx) => {
        let settings = await Modules.Users.getUserSettings(ctx, uid);
        if (!args.settings) {
            return settings;
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
        }

        if (countUnreadChats) {
            settings.globalCounterType = excludeMutedChats ? 'unread_chats_no_muted' : 'unread_chats';
        } else {
            settings.globalCounterType = excludeMutedChats ? 'unread_messages_no_muted' : 'unread_messages';
        }

        settings.invalidate();
        await Modules.Messaging.onGlobalCounterTypeChanged(ctx, uid);

        return settings;
    });
});

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
        primaryEmail: async (src: UserSettings, args: {}, ctx: AppContext) => (await Store.User.findById(ctx, src.id))!!.email,
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
        mobile: src => src.mobile
    },
    PlatformNotificationSettings: {
        notificationPreview: src => src.notificationPreview.toUpperCase()
    },
    Query: {
        settings: withUser(async (ctx, args, uid) => {
            return Modules.Users.getUserSettings(ctx, uid);
        }),
    },
    Mutation: {
        settingsUpdate: updateSettingsResolver,
        updateSettings: updateSettingsResolver
    },
    Subscription: {
        watchSettings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (_: any, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                let ended = false;
                return {
                    ...(async function* func() {
                        while (!ended) {
                            let settings = await Modules.Users.getUserSettings(ctx, ctx.auth.uid!!);
                            yield settings;
                            await Modules.Users.waitForNextSettings(ctx, ctx.auth.uid!);
                        }
                    })(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        },
        settingsWatch: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                let ended = false;
                return {
                    ...(async function* func() {
                        while (!ended) {
                            let settings = await Modules.Users.getUserSettings(ctx, ctx.auth.uid!!);
                            yield settings;
                            await Modules.Users.waitForNextSettings(ctx, ctx.auth.uid!);
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
