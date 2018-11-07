import { Modules } from 'openland-modules/Modules';
import { withLogContext } from 'openland-log/withLogContext';
import { createLogger } from 'openland-log/createLogger';
import { CallContext } from 'openland-server/api/utils/CallContext';
import { PushConfig } from './PushConfig';

const pushLog = createLogger('push');

export default {
    Query: {
        pushSettings: () => ({
            webPushKey: PushConfig.webPush && PushConfig.webPush.public
        })
    },
    Mutation: {
        registerWebPush: async (_: any, args: { endpoint: string }, context: CallContext) => {
            if (!context.uid || !context.tid) {
                throw Error('Unable to register push for non-registered user');
            }
            await Modules.Push.registerPushWeb(context.uid!, context.tid!, args.endpoint);
            return 'ok';
        },
        registerPush: async (_: any, args: { endpoint: string, type: 'WEB_PUSH' | 'IOS' | 'ANDROID' }, context: CallContext) => {
            if (!context.uid || !context.tid) {
                throw Error('Unable to register push for non-registered user');
            }
            return await withLogContext('push', async () => {
                pushLog.log('Received push token: ' + JSON.stringify(args.endpoint));
                if (args.type === 'IOS') {
                    let parsed = JSON.parse(args.endpoint);
                    await Modules.Push.registerPushApple(context.uid!, context.tid!, parsed.token, parsed.bundleId, parsed.sandbox);
                    return 'ok';
                }
                if (args.type === 'ANDROID') {
                    let parsed = JSON.parse(args.endpoint);
                    await Modules.Push.registerPushAndroid(context.uid!, context.tid!, parsed.token, parsed.bundleId, parsed.sandbox);
                    return 'ok';
                }
                if (args.type === 'WEB_PUSH') {
                    await Modules.Push.registerPushWeb(context.uid!, context.tid!, args.endpoint);
                    return 'ok';
                }
                throw Error('Unknown type: ' + args.type);
            });
        }
    }
};