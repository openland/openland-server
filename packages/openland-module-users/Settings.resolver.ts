import { Store } from './../openland-module-db/FDB';
import { UserSettings } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';

export default {
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
        emailFrequency: src => src.emailFrequency as any,
        desktopNotifications: src => src.desktopNotifications as any,
        mobileNotifications: src => src.mobileNotifications as any,
        commentNotifications: src => src.commentNotifications ? src.commentNotifications : 'none' as any,
        commentNotificationsDelivery: src => src.commentNotificationsDelivery ? src.commentNotificationsDelivery : 'none' as any,
        mobileAlert: src => src.mobileAlert !== null && src.mobileAlert !== undefined ? src.mobileAlert : true,
        mobileIncludeText: src => src.mobileIncludeText !== null && src.mobileAlert !== undefined ? src.mobileIncludeText : true,
        notificationsDelay: src => src.notificationsDelay as any,
        countUnreadChats: src => !src.globalCounterType ? false : (src.globalCounterType === 'unread_chats' || src.globalCounterType === 'unread_chats_no_muted'),
        excludeMutedChats: src => !src.globalCounterType ? false : (src.globalCounterType === 'unread_messages_no_muted' || src.globalCounterType === 'unread_chats_no_muted'),
    },
    Query: {
        settings: withUser(async (ctx, args, uid) => {
            return Modules.Users.getUserSettings(ctx, uid);
        }),
    },
    Mutation: {
        settingsUpdate: withUser(async (parent, args, uid) => {
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
                if (args.settings.commentNotifications && args.settings.commentNotifications !== null) {
                    settings.commentNotifications = args.settings.commentNotifications as any;
                }
                if (args.settings.commentNotificationsDelivery && args.settings.commentNotificationsDelivery !== null) {
                    settings.commentNotificationsDelivery = args.settings.commentNotificationsDelivery as any;
                }

                let countUnreadChats = !settings.globalCounterType ? false : (settings.globalCounterType === 'unread_chats' || settings.globalCounterType === 'unread_chats_no_muted');
                let excludeMutedChats = !settings.globalCounterType ? false : (settings.globalCounterType === 'unread_messages_no_muted' || settings.globalCounterType === 'unread_chats_no_muted');

                if (args.settings.countUnreadChats !== undefined && args.settings.countUnreadChats !== null) {
                    countUnreadChats = args.settings.countUnreadChats;
                }
                if (args.settings.excludeMutedChats !== undefined && args.settings.excludeMutedChats !== null) {
                    excludeMutedChats = args.settings.excludeMutedChats;
                }

                if (countUnreadChats) {
                    settings.globalCounterType = excludeMutedChats ? 'unread_chats_no_muted' : 'unread_chats';
                } else {
                    settings.globalCounterType = excludeMutedChats ? 'unread_messages_no_muted' : 'unread_messages';
                }

                return settings;
            });
        }),
        updateSettings: withUser(async (parent, args, uid) => {
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
                if (args.settings.commentNotifications && args.settings.commentNotifications !== null) {
                    settings.commentNotifications = args.settings.commentNotifications as any;
                }
                if (args.settings.commentNotificationsDelivery && args.settings.commentNotificationsDelivery !== null) {
                    settings.commentNotificationsDelivery = args.settings.commentNotificationsDelivery as any;
                }

                let countUnreadChats = !settings.globalCounterType ? false : (settings.globalCounterType === 'unread_chats' || settings.globalCounterType === 'unread_chats_no_muted');
                let excludeMutedChats = !settings.globalCounterType ? false : (settings.globalCounterType === 'unread_messages_no_muted' || settings.globalCounterType === 'unread_chats_no_muted');

                if (args.settings.countUnreadChats !== undefined && args.settings.countUnreadChats !== null) {
                    countUnreadChats = args.settings.countUnreadChats;
                }
                if (args.settings.excludeMutedChats !== undefined && args.settings.excludeMutedChats !== null) {
                    excludeMutedChats = args.settings.excludeMutedChats;
                }

                if (countUnreadChats) {
                    settings.globalCounterType = excludeMutedChats ? 'unread_chats_no_muted' : 'unread_chats';
                } else {
                    settings.globalCounterType = excludeMutedChats ? 'unread_messages_no_muted' : 'unread_messages';
                }
                await Modules.Messaging.onGlobalCounterTypeChanged(ctx, uid);

                return settings;
            });
        })
    },
    Subscription: {
        watchSettings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (_: any, args, ctx) => {
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
} as GQLResolver;