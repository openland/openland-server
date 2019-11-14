import { createPushWorker } from './workers/PushWorker';
import { Store } from 'openland-module-db/FDB';
import { PushRepository } from './repositories/PushRepository';
import { createAppleWorker } from './workers/AppleWorker';
import { createAndroidWorker } from './workers/AndroidWorker';
import { createWebWorker } from './workers/WebWorker';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Push } from './workers/types';
import * as Firebase from 'firebase-admin';
import { Modules } from '../openland-modules/Modules';

@injectable()
export class PushModule {
    readonly repository = new PushRepository(Store);
    readonly appleWorker = createAppleWorker(this.repository);
    readonly androidWorker = createAndroidWorker(this.repository);
    readonly webWorker = createWebWorker(this.repository);
    readonly worker = createPushWorker(this.repository);

    debugAndroidSendDataPush: ((ctx: Context, uid: number, message: string) => Promise<void>) | undefined = undefined;

    start = () => {
        // Load config
        const { PushConfig } = require('./PushConfig');
        this.debugAndroidSendDataPush = async (ctx: Context, uid: number, message: string) => {
            let firbaseApps: { [pkg$: string]: Firebase.app.App } = {};
            for (let creds of PushConfig.google!) {
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

            let androidTokens = await Modules.Push.repository.getUserAndroidPushTokens(ctx, uid);
            for (let token of androidTokens) {
                let firebase = firbaseApps[token.packageId];
                let res = await firebase.messaging().send({
                    data: {
                        ['title']: 'Test data push',
                        ['message']: message,
                        ['soundName']: 'default',
                    },
                    android: {
                        priority: 'high'
                    },
                    token: token.token
                });
                if (res.includes('messaging/invalid-registration-token') || res.includes('messaging/registration-token-not-registered')) {
                    continue;
                }
            }
        };
    }

    async registerPushApple(ctx: Context, uid: number, tid: string, token: string, bundleId: string, sandbox: boolean) {
        await this.repository.registerPushApple(ctx, uid, tid, token, bundleId, sandbox);
    }

    async registerPushAndroid(ctx: Context, uid: number, tid: string, token: string, packageId: string, sandbox: boolean) {
        await this.repository.registerPushAndroid(ctx, uid, tid, token, packageId, sandbox);
    }

    async registerPushWeb(ctx: Context, uid: number, tid: string, endpoint: string) {
        await this.repository.registerPushWeb(ctx, uid, tid, endpoint);
    }

    async registerPushSafari(ctx: Context, uid: number, tid: string, token: string, bundleId: string) {
        await this.repository.registerPushSafari(ctx, uid, tid, token, bundleId);
    }

    async disablePushSafari(ctx: Context, token: string, bundleId: string) {
        await this.repository.disablePushSafari(ctx, token, bundleId);
    }

    async sendCounterPush(ctx: Context, uid: number) {
        return this.worker.pushWork(ctx, {
            uid: uid,
            counter: 0,
            conversationId: null,
            mobile: true,
            desktop: false,
            picture: null,
            silent: true,
            title: '',
            body: '',
            mobileAlert: false,
            mobileIncludeText: false
        });
    }

    async pushWork(ctx: Context, push: Push) {
        await this.worker.pushWork(ctx, push);
    }
}