import { OwnerType, ShortnameRepository } from './repositories/ShortnameRepository';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { lazyInject } from '../openland-modules/Modules.container';

@injectable()
export class ShortnameModule {
    @lazyInject('ShortnameRepository')
    private readonly repo!: ShortnameRepository;

    async findShortname(ctx: Context, shortname: string) {
        return this.repo.findShortname(ctx, shortname);
    }

    async findShortnameByOwner(parent: Context, ownerType: OwnerType, ownerId: number) {
        return this.repo.findShortnameByOwner(parent, ownerType, ownerId);
    }

    async setShortName(parent: Context, shortname: string, ownerType: OwnerType, ownerId: number, uid: number) {
        return this.repo.setShortName(parent, shortname, ownerType, ownerId, uid);
    }

    async freeShortName(parent: Context, ownerType: OwnerType, ownerId: number) {
        return this.repo.freeShortName(parent, ownerType, ownerId);
    }

    start = async () => {
        // Nothing to do
    }
}