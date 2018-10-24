import { createPushWorker } from './workers/PushWorker';
import { FDB } from 'openland-module-db/FDB';
import { startImporterWorker } from './workers/ImporterWorker';
import { PushRepository } from './repositories/PushRepository';

export class PushModule {
    readonly worker = createPushWorker();
    readonly repository = new PushRepository(FDB);

    start = () => {
        startImporterWorker(this);
    }

    async registerPushApple(uid: number, tid: string, token: string, bundleId: string, sandbox: boolean) {
        await this.repository.registerPushApple(uid, tid, token, bundleId, sandbox);
    }

    async registerPushAndroid(uid: number, tid: string, token: string, packageId: string, sandbox: boolean) {
        await this.repository.registerPushAndroid(uid, tid, token, packageId, sandbox);
    }

    async registerPushWeb(uid: number, tid: string, endpoint: string) {
        await this.repository.registerPushWeb(uid, tid, endpoint);
    }

    sendCounterPush(uid: number, conversationId: number, counter: number) {
        return this.worker.pushWork({
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