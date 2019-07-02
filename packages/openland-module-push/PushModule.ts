import { createPushWorker } from './workers/PushWorker';
import { FDB } from 'openland-module-db/FDB';
import { PushRepository } from './repositories/PushRepository';
import { createAppleWorker } from './workers/AppleWorker';
import { createAndroidWorker } from './workers/AndroidWorker';
import { createWebWorker } from './workers/WebWorker';
import { injectable } from 'inversify';
import { Context } from '@openland/context';

@injectable()
export class PushModule {
    readonly repository = new PushRepository(FDB);
    readonly appleWorker = createAppleWorker(this.repository);
    readonly androidWorker = createAndroidWorker(this.repository);
    readonly webWorker = createWebWorker(this.repository);
    readonly worker = createPushWorker(this.repository);

    start = () => {
        // Load config
        require('./PushConfig');
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

}