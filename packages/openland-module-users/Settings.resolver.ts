import { UserSettings } from 'openland-module-db/schema';
import { IDs } from 'openland-server/api/utils/IDs';
import { FDB } from 'openland-module-db/FDB';
import { withUser } from 'openland-server/api/utils/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { CallContext } from 'openland-server/api/utils/CallContext';

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
    NotificationsDelay: {
        NONE: 'none',
        MIN_1: '1min',
        MIN_15: '15min'
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
        settings: withUser(async (args, uid) => {
            return Modules.Users.getUserSettings(uid);
        }),
    },
    Mutation: {
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
        }),
        settingsUpdate: withUser<{ settings: { emailFrequency?: string | null, desktopNotifications?: string | null, mobileNotifications?: string | null, mobileAlert?: boolean | null, mobileIncludeText?: boolean | null, notificationsDelay?: boolean | null } }>(async (args, uid) => {
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
        },
        settingsWatch: {
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