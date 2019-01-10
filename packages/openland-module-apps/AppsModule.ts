import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { AppsRepository } from './repositories/AppsRepository';
import { Context } from '../openland-utils/Context';

@injectable()
export class AppsModule {
    @lazyInject('AppsRepository')
    private readonly repo!: AppsRepository;

    start = () => {

        // Nothing to do
    }

    async createApp(ctx: Context, uid: number, name: string, shortname: string) {
        return this.repo.createApp(ctx, uid, name, shortname);
    }

    async findAppsCreatedByUser(ctx: Context, uid: number) {
        return this.repo.findAppsCreatedByUser(ctx, uid);
    }

    async getAppToken(ctx: Context, appId: number) {
        return this.repo.getAppToken(ctx, appId);
    }

    async refreshAppToken(ctx: Context, uid: number, appId: number) {
        return this.repo.refreshAppToken(ctx, uid, appId);
    }

    async isAppOwner(ctx: Context, uid: number, appId: number) {
        return this.repo.isAppOwner(ctx, uid, appId);
    }
}