import { Modules } from 'openland-modules/Modules';
import { PushConfig } from './PushConfig';
import { AppContext } from 'openland-modules/AppContext';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { createLogger } from '@openland/log';
import { withPermission } from '../openland-module-api/Resolvers';
import { IDs } from '../openland-module-api/IDs';
import * as Firebase from 'firebase-admin';

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
        registerPush: async (_: any, args, ctx) => {
            if (!ctx.auth.uid || !ctx.auth.tid) {
                throw Error('Unable to register push for non-registered user');
            }
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
            if (args.type === 'SAFARI') {
                let parsed = JSON.parse(args.endpoint);
                await Modules.Push.registerPushSafari(ctx, ctx.auth.uid!, ctx.auth.tid!, parsed.token, parsed.bundleId);
                return 'ok';
            }
            throw Error('Unknown type: ' + args.type);
        },
        debugSendAndroidDataPush: withPermission('super-admin',  async (ctx, args) => {
            if (!PushConfig.google) {
                return false;
            }

            let firbaseApps: { [pkg: string]: Firebase.app.App } = {};
            for (let creds of PushConfig.google) {
                for (let pkg of creds.packages) {
                    firbaseApps[pkg] = Firebase.initializeApp({
                        credential: Firebase.credential.cert({
                            privateKey: creds.privateKey,
                            projectId: creds.projectId,
                            clientEmail: creds.clientEmail
                        }),
                        databaseURL: creds.databaseURL
                    }, pkg);
                }
            }

            let uid = IDs.User.parse(args.uid);
            let androidTokens = await Modules.Push.repository.getUserAndroidPushTokens(ctx, uid);
            for (let token of androidTokens) {
                let firebase = firbaseApps[token.packageId];
                let res = await firebase.messaging().send({
                    data: {
                        ['title']: 'Test data push',
                        ['message']: args.message,
                        ['soundName']: 'default',
                    },
                    android: {
                        priority: 'high'
                    },
                    token: token.token
                });
                if (res.includes('messaging/invalid-registration-token') || res.includes('messaging/registration-token-not-registered')) {
                    return false;
                }
            }
            return true;
        })
    }
} as GQLResolver;