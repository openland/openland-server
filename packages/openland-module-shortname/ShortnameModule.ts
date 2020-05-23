import { OwnerType, ShortnameRepository } from './repositories/ShortnameRepository';
import { inject, injectable } from 'inversify';
import { Context } from '@openland/context';

@injectable()
export class ShortnameModule {
    private readonly repo: ShortnameRepository;

    constructor(@inject('ShortnameRepository') repo: ShortnameRepository) {
        this.repo = repo;
    }

    async findShortname(ctx: Context, shortname: string) {
        return this.repo.findShortname(ctx, shortname);
    }

    async findShortnameByOwner(parent: Context, ownerType: OwnerType, ownerId: number) {
        return this.repo.findShortnameByOwner(parent, ownerType, ownerId);
    }

    async setShortName(parent: Context, shortname: string, ownerType: OwnerType, ownerId: number, uid: number) {
        return this.repo.setShortName(parent, shortname, ownerType, ownerId, uid);
    }

    start = async () => {
        // Nothing to do
    }
}