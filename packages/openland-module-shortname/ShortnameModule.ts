import { ShortnameRepository } from './repositories/ShortnameRepository';
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

    async findUserShortname(ctx: Context, uid: number) {
        return this.repo.findUserShortname(ctx, uid);
    }

    async findOrganizationShortname(ctx: Context, oid: number) {
        return this.repo.findOrganizationShortname(ctx, oid);
    }

    async setShortnameToUser(ctx: Context, shortname: string, uid: number) {
        return this.repo.setShortnameToUser(ctx, shortname, uid);
    }

    async setShortnameToOrganization(ctx: Context, shortname: string, oid: number, uid: number) {
        return this.repo.setShortnameToOrganization(ctx, shortname, oid, uid);
    }

    start = () => {
        // Nothing to do
    }
}