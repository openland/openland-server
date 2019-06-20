import { UserSettings } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { FDB } from 'openland-module-db/FDB';
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
        id: (src: UserSettings) => IDs.Settings.serialize(src.id),
        primaryEmail: async (src: UserSettings, args: {}, ctx: AppContext) => (await FDB.User.findById(ctx, src.id))!!.email,
        emailFrequency: (src: UserSettings) => src.emailFrequency as any,
        desktopNotifications: (src: UserSettings) => src.desktopNotifications as any,
        mobileNotifications: (src: UserSettings) => src.mobileNotifications as any,
        commentNotifications: (src: UserSettings) => src.commentNotifications ? src.commentNotifications : 'none' as any,
        commentNotificationsDelivery: (src: UserSettings) => src.commentNotificationsDelivery ? src.commentNotificationsDelivery : 'none' as any,
        mobileAlert: (src: UserSettings) => src.mobileAlert !== null && src.mobileAlert !== undefined ? src.mobileAlert : true,
        mobileIncludeText: (src: UserSettings) => src.mobileIncludeText !== null && src.mobileAlert !== undefined ? src.mobileIncludeText : true,
        notificationsDelay: (src: UserSettings) => src.notificationsDelay as any,
    },
    Query: {
        settings: withUser(async (ctx, args, uid) => {
            return Modules.Users.getUserSettings(ctx, uid);
        }),
    },
    Mutation: {
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
                return settings;
            });
        }),
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