import { CallContext } from './utils/CallContext';
import { withAny } from './utils/Resolvers';
import { Modules } from 'openland-modules/Modules';

export const Resolver = {
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
    }
};