import { Modules } from 'openland-modules/Modules';
import { withAny } from 'openland-module-api/Resolvers';
import { CallContext } from 'openland-module-api/CallContext';

export default {
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

        // Deprecated
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
            await Modules.Presence.setOnline(context.uid, context.tid!, args.timeout, args.platform || 'unknown');
            return 'ok';
        },
        alphaReportOffline: withAny<{ platform?: string }>(async (args, ctx) => {
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
    }
};