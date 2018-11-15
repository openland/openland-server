import { Modules } from 'openland-modules/Modules';
import { withLogContext } from 'openland-log/withLogContext';
import { createLogger } from 'openland-log/createLogger';
import { PushConfig } from './PushConfig';
import { AppContext } from 'openland-modules/AppContext';

const pushLog = createLogger('push');

export default {
    Query: {
        pushSettings: () => ({
            webPushKey: PushConfig.webPush && PushConfig.webPush.public
        })
    },
    Mutation: {
        registerWebPush: async (_: any, args: { endpoint: string }, ctx: AppContext) => {
            if (!ctx.auth.uid || !ctx.auth.tid) {
                throw Error('Unable to register push for non-registered user');
            }
            await Modules.Push.registerPushWeb(ctx, ctx.auth.uid!, ctx.auth.tid!, args.endpoint);
            return 'ok';
        },
        registerPush: async (_: any, args: { endpoint: string, type: 'WEB_PUSH' | 'IOS' | 'ANDROID' }, ctx: AppContext) => {
            if (!ctx.auth.uid || !ctx.auth.tid) {
                throw Error('Unable to register push for non-registered user');
            }
            return await withLogContext('push', async () => {
                pushLog.log(ctx, 'Received push token: ' + JSON.stringify(args.endpoint));
                if (args.type === 'IOS') {
                    let parsed = JSON.parse(args.endpoint);
                    await Modules.Push.registerPushApple(ctx, ctx.auth.uid!, ctx.auth.tid!, parsed.token, parsed.bundleId, parsed.sandbox);
                    return 'ok';
                }
                if (args.type === 'ANDROID') {
                    let parsed = JSON.parse(args.endpoint);
                    await Modules.Push.registerPushAndroid(ctx, ctx.auth.uid!, ctx.auth.tid!, parsed.token, parsed.bundleId, parsed.sandbox);
                    return 'ok';
                }
                if (args.type === 'WEB_PUSH') {
                    await Modules.Push.registerPushWeb(ctx, ctx.auth.uid!, ctx.auth.tid!, args.endpoint);
                    return 'ok';
                }
                throw Error('Unknown type: ' + args.type);
            });
        }
    }
};