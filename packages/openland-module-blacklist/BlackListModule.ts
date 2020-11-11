import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { BlackListRepository } from './repositories/BlackListRepository';
import { Context } from '@openland/context';

@injectable()
export class BlackListModule {
    public start = async () => {
        // Noop
    }

    @lazyInject(BlackListRepository)
    private readonly repo!: BlackListRepository;

    async banUser(parent: Context, uid: number, banUid: number) {
        return await this.repo.banUser(parent, uid, banUid);
    }

    async unBanUser(parent: Context, uid: number, unBanUid: number) {
        return await this.repo.unBanUser(parent, uid, unBanUid);
    }

    async isUserBanned(parent: Context, uid: number, targetUid: number) {
        return await this.repo.isUserBanned(parent, uid, targetUid);
    }

    async getUserBlackList(parent: Context, uid: number) {
        return await this.repo.getUserBlackList(parent, uid);
    }
}