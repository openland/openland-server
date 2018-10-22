import { createPushWorker } from './workers/PushWorker';

export class PushModule {
    readonly worker = createPushWorker();

    start = () => {
        // Nothing to do
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