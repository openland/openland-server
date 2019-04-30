import { Modules } from 'openland-modules/Modules';
import { withAny } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { OnlineEvent } from './PresenceModule';
import { AppContext } from 'openland-modules/AppContext';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export default {
    OnlineEvent: {
        type: (src: OnlineEvent) => src.online ? 'online' : 'offline',
        user: (src: OnlineEvent) => src.userId,
        timeout: (src: OnlineEvent) => src.timeout,
    },
    Mutation: {
        presenceReportOnline: async (_, args, ctx) => {
            if (!ctx.auth.uid) {
                throw Error('Not authorized');
            }
            if (args.timeout <= 0) {
                throw Error('Invalid input');
            }
            if (args.timeout > 5000) {
                throw Error('Invalid input');
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
    },
    Subscription: {
        alphaSubscribeChatOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                let conversationIds = args.conversations.map(c => IDs.Conversation.parse(c));

                if (!ctx.auth.uid) {
                    throw Error('Not logged in');
                }

                let uids: number[] = [];

                for (let chatId of conversationIds) {
                    uids.push(...await Modules.Messaging.room.findConversationMembers(ctx, chatId));
                }

                return Modules.Presence.createPresenceStream(ctx.auth.uid, uids);
            }
        },
        alphaSubscribeOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw Error('Not logged in');
                }
                let userIds = args.users.map(c => IDs.User.parse(c));

                return Modules.Presence.createPresenceStream(ctx.auth.uid!, userIds);
            }
        },
        chatOnlinesCount: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw Error('Not logged in');
                }
                return Modules.Presence.createChatOnlineCountStream(ctx.auth.uid, IDs.Conversation.parse(args.chatId));
            }
        }
    }
} as GQLResolver;