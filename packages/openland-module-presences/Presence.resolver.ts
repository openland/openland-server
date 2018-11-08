import { Modules } from 'openland-modules/Modules';
import { withAny } from 'openland-module-api/Resolvers';
import { CallContext } from 'openland-module-api/CallContext';
import { IDs } from 'openland-module-api/IDs';
import { OnlineEvent } from './PresenceModule';

export default {
    OnlineEvent: {
        type: (src: OnlineEvent) => src.online ? 'online' : 'offline',
        user: (src: OnlineEvent) => src.userId,
        timeout: (src: OnlineEvent) => src.timeout,
    },
    Mutation: {
        presenceReportOnline: async (_: any, args: { timeout: number, platform?: string }, context: CallContext) => {
            if (!context.uid) {
                throw Error('Not authorized');
            }
            if (args.timeout <= 0) {
                throw Error('Invalid input');
            }
            if (args.timeout > 5000) {
                throw Error('Invalid input');
            }
            await Modules.Presence.setOnline(context.uid, context.tid!, args.timeout, args.platform || 'unknown');
            return 'ok';
        },
        presenceReportOffline: withAny<{ platform?: string }>(async (args, ctx) => {
            // TODO: Implement
            return 'ok';
        }),

        // TODO: Move to Push Module
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
    },
    Subscription: {
        alphaSubscribeChatOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { conversations: string[] }, context: CallContext) {
                let conversationIds = args.conversations.map(c => IDs.Conversation.parse(c));

                if (!context.uid) {
                    throw Error('Not logged in');
                }

                let uids: number[] = [];

                for (let chatId of conversationIds) {
                    uids.push(...await Modules.Messaging.conv.findConversationMembers(chatId));
                }

                return Modules.Presence.createPresenceStream(context.uid, uids);
            }
        },
        alphaSubscribeOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { users: number[] }, context: CallContext) {
                if (!context.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Presence.createPresenceStream(context.uid!, args.users);
            }
        }
    }
};