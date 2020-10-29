import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { SocialImageRepository } from './repositories/SocialImageRepository';
import { Context } from '@openland/context';

@injectable()
export class SocialImageModule {
    @lazyInject('SocialImageRepository')
    private readonly repo!: SocialImageRepository;

    start = async () => {
        // noop
    }

    getRoomSocialImage(ctx: Context, cid: number) {
        return this.repo.getRoomSocialImage(ctx, cid);
    }

    onRoomProfileUpdated(ctx: Context, cid: number) {
        return this.repo.onRoomUpdated(ctx, cid);
    }

    getUserSocialImage(ctx: Context, uid: number) {
        return this.repo.getUserSocialImage(ctx, uid);
    }

    onUserUpdated(ctx: Context, uid: number) {
        return this.repo.onUserUpdated(ctx, uid);
    }

    getOrganizationSocialImage(ctx: Context, oid: number) {
        return this.repo.getOrganizationSocialImage(ctx, oid);
    }

    onOrganizationUpdated(ctx: Context, oid: number) {
        return this.repo.onOrganizationUpdated(ctx, oid);
    }
}