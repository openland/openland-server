import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { AppsRepository } from './repositories/AppsRepository';
import { Context } from '../openland-utils/Context';
import { ImageRef } from '../openland-module-media/ImageRef';

@injectable()
export class AppsModule {
    @lazyInject('AppsRepository')
    private readonly repo!: AppsRepository;

    start = () => {

        // Nothing to do
    }

    async createApp(ctx: Context, uid: number, name: string, extra: { photo?: ImageRef, about?: string, shortname?: string }) {
        return this.repo.createApp(ctx, uid, name, extra);
    }

    async findAppsCreatedByUser(ctx: Context, uid: number) {
        return this.repo.findAppsCreatedByUser(ctx, uid);
    }

    async getAppToken(ctx: Context, uid: number, appId: number) {
        return this.repo.getAppToken(ctx, uid, appId);
    }

    async refreshAppToken(ctx: Context, uid: number, appId: number) {
        return this.repo.refreshAppToken(ctx, uid, appId);
    }

    async isAppOwner(ctx: Context, uid: number, appId: number) {
        return this.repo.isAppOwner(ctx, uid, appId);
    }

    async deleteApp(ctx: Context, uid: number, appId: number) {
        return this.repo.deleteApp(ctx, uid, appId);
    }

    async createChatHook(ctx: Context, uid: number, appId: number, cid: number) {
        return this.repo.createChatHook(ctx, uid, appId, cid);
    }
}