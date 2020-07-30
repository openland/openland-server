import { Config } from 'openland-config/Config';
import { createPushWorker } from './workers/PushWorker';
import { Store } from 'openland-module-db/FDB';
import { PushRepository } from './repositories/PushRepository';
import { createAppleWorker } from './workers/AppleWorker';
import { createAndroidWorker } from './workers/AndroidWorker';
import { createWebWorker } from './workers/WebWorker';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Push } from './workers/types';
import WebPush from 'web-push';

@injectable()
export class PushModule {
    readonly repository = new PushRepository(Store);
    readonly appleWorker = createAppleWorker(this.repository);
    readonly androidWorker = createAndroidWorker(this.repository);
    readonly webWorker = createWebWorker(this.repository);
    readonly worker = createPushWorker(this.repository);

    start = async () => {
        if (Config.pushWeb) {
            WebPush.setVapidDetails(
                'mailto:support@openland.com',
                Config.pushWeb.public,
                Config.pushWeb.private
            );
        }
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
            deepLink: null,
            mobile: true,
            desktop: false,
            picture: null,
            silent: true,
            title: '',
            body: '',
            mobileAlert: false,
            mobileIncludeText: false,
            messageId: null,
            commentId: null
        });
    }

    async pushWork(ctx: Context, push: Push) {
        await this.worker.pushWork(ctx, push);
    }
}