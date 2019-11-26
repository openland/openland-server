import { Modules } from 'openland-modules/Modules';
import { withAccount, withAny } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { OnlineEvent } from './PresenceModule';
import { AppContext } from 'openland-modules/AppContext';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { CacheRepository } from '../openland-module-cache/CacheRepository';
import { UserError } from '../openland-errors/UserError';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
// import { createIterator } from '../openland-utils/asyncIterator';

const cache = new CacheRepository<{ at: number }>('user_installed_apps');

export default {
    OnlineEvent: {
        userId: (src: OnlineEvent) => IDs.User.serialize(src.userId),
        timeout: (src: OnlineEvent) => src.timeout,
        online: (src: OnlineEvent) => src.online,
        active: (src: OnlineEvent) => src.active,
        lastSeen: (src: OnlineEvent) => src.lastSeen.toString(10),

        type: (src: OnlineEvent) => src.online ? 'online' : 'offline',
        user: (src: OnlineEvent) => src.userId,
    },
    IsAppInstalledResponse: {
        installed: src => src.installed,
        installedAt: src => src.installedAt
    },
    Mutation: {
        presenceReportOnline: async (_, args, ctx) => {
            if (!ctx.auth.uid) {
                throw new UserError('Not authorized');
            }
            if (args.timeout <= 0) {
                throw new UserError('Invalid input');
            }
            if (args.timeout > 5000) {
                throw new UserError('Invalid input');
            }
            let active = (args.active !== undefined && args.active !== null) ? args.active! : true;

            await Modules.Presence.setOnline(ctx, ctx.auth.uid, ctx.auth.tid!, args.timeout, args.platform || 'unknown', active);
            return 'ok';
        },
        presenceReportOffline: withAny(async (ctx, args) => {
            await Modules.Presence.setOffline(ctx, ctx.auth.uid!);
            return 'ok';
        }),

        // TODO: Move to Push Module
        alphaReportActive: async (_: any, args: { timeout: number, platform?: string }, ctx: AppContext) => {
            if (!ctx.auth.uid) {
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
        alphaSetDesktopInstalled: withAccount(async (parent, args, uid) => {
            await cache.write(parent, `${uid}_desktop`, { at: args.at.getTime() });
            return true;
        }),
        alphaSetMobileInstalled: withAccount(async (parent, args, uid) => {
            await cache.write(parent, `${uid}_mobile`, { at: args.at.getTime() });
            return true;
        }),
    },
    Query: {
        isDesktopInstalled: withAccount(async (parent, args, uid) => {
            let val = await cache.read(parent, `${uid}_desktop`);
            if (!val) {
                return { installed: false };
            }
            return { installed: true, installedAt: val.at };
        }),
        isMobileInstalled: withAccount(async (parent, args, uid) => {
            let val = await cache.read(parent, `${uid}_mobile`);
            if (!val) {
                return { installed: false };
            }
            return { installed: true, installedAt: val.at };
        }),
    },
    Subscription: {
        alphaSubscribeChatOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                let conversationIds = args.conversations.map(c => IDs.Conversation.parse(c));

                if (!ctx.auth.uid) {
                    throw Error('Not logged in');
                }

                let uids: number[] = [];

                for (let chatId of conversationIds) {
                    uids.push(...await Modules.Messaging.room.findConversationMembers(ctx, chatId));
                }

                return Modules.Presence.createPresenceStream(ctx.auth.uid, uids);

                // return createIterator(() => {
                //     // do nothing
                // });
            }
        },
        alphaSubscribeOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                let userIds = args.users.filter(c => {
                    try {
                        IDs.User.parse(c);
                        return true;
                    } catch {
                        return false;
                    }
                }).map(c => IDs.User.parse(c));

                return Modules.Presence.createPresenceStream(ctx.auth.uid!, userIds);

                // return createIterator(() => {
                //     // do nothing
                // });
            }
        },
        chatOnlinesCount: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                // return createIterator(() => {
                //     // do nothing
                // });
                return Modules.Presence.createChatOnlineCountStream(ctx.auth.uid, IDs.Conversation.parse(args.chatId));
            }
        }
    }
} as GQLResolver;