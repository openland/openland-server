import { CallContext } from './utils/CallContext';
import { IDs } from './utils/IDs';
import { withUser, withAny } from './utils/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { UserSettings } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

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
        user: withAny<{ id: string }>((args) => {
            return FDB.User.findById(IDs.User.parse(args.id));
        }),
    },
    Mutation: {
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