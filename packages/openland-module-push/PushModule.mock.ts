import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Push } from './workers/types';

export interface PushModuleMockContext {
    applePushes: { uid: number, tid: string, token: string, bundleId: string, sandbox: boolean }[];
    androidPushes: { uid: number, tid: string, token: string, packageId: string, sandbox: boolean }[];
    webPushes: { uid: number, tid: string, endpoint: string }[];
    safariPushes: { uid: number, tid: string, token: string, bundleId: string }[];
    counterPushes: { uid: number }[];
    pushedWork: Push[];
}

let pushModuleResults: PushModuleMockContext;
const clearPushResults = () => {
    pushModuleResults = {
        applePushes: [],
        androidPushes: [],
        webPushes: [],
        safariPushes: [],
        counterPushes: [],
        pushedWork: []
    };
};
clearPushResults();

export { pushModuleResults, clearPushResults };

@injectable()
export class PushModuleMock {
    start = () => {
        // Load config
    }

    async registerPushApple(ctx: Context, uid: number, tid: string, token: string, bundleId: string, sandbox: boolean) {
        pushModuleResults.applePushes.push({ uid, tid, token, bundleId, sandbox });
        return;
    }

    async registerPushAndroid(ctx: Context, uid: number, tid: string, token: string, packageId: string, sandbox: boolean) {
        pushModuleResults.androidPushes.push({ uid, tid, token, packageId, sandbox });
        return;
    }

    async registerPushWeb(ctx: Context, uid: number, tid: string, endpoint: string) {
        pushModuleResults.webPushes.push({ uid, tid, endpoint });
        return;
    }

    async registerPushSafari(ctx: Context, uid: number, tid: string, token: string, bundleId: string) {
        pushModuleResults.safariPushes.push({ uid, tid, token, bundleId });
        return;
    }

    async disablePushSafari(ctx: Context, token: string, bundleId: string) {
        return;
    }

    async sendCounterPush(ctx: Context, uid: number) {
        pushModuleResults.counterPushes.push({ uid });
        return;
    }

    async pushWork(ctx: PushModuleMockContext, push: Push) {
        pushModuleResults.pushedWork.push(push);
        return;
    }
}