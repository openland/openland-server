import { createPushWorker } from './workers/PushWorker';
import { FDB } from 'openland-module-db/FDB';
import { PushRepository } from './repositories/PushRepository';
import { createAppleWorker } from './workers/AppleWorker';
import { createAndroidWorker } from './workers/AndroidWorker';
import { createWebWorker } from './workers/WebWorker';
import { injectable } from 'inversify';
import { Context } from 'openland-utils/Context';

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

    sendCounterPush(ctx: Context, uid: number, conversationId: number, counter: number) {
        return this.worker.pushWork(ctx, {
            uid: uid,
            counter: counter,
            conversationId: conversationId,
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