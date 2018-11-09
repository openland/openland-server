import { ShortnameRepository } from './repositories/ShortnameRepository';
import { FDB } from 'openland-module-db/FDB';
import { injectable } from 'inversify';

@injectable()
export class ShortnameModule {
    private readonly repo = new ShortnameRepository(FDB);

    async findShortname(shortname: string) {
        return this.repo.findShortname(shortname);
    }

    async findUserShortname(uid: number) {
        return this.repo.findUserShortname(uid);
    }

    async findOrganizationShortname(oid: number) {
        return this.repo.findOrganizationShortname(oid);
    }

    async setShortnameToUser(shortname: string, uid: number) {
        return this.repo.setShortnameToUser(shortname, uid);
    }

    async setShortnameToOrganization(shortname: string, oid: number) {
        return this.repo.setShortnameToOrganization(shortname, oid);
    }

    start = () => {
        // Nothing to do
    }
}