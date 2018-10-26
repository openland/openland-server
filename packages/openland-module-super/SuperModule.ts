import { SuperRepository } from './repositories/SuperRepository';
import { FDB } from 'openland-module-db/FDB';

export class SuperModule {
    readonly repo = new SuperRepository(FDB);

    async findAllSuperAdmins() {
        return this.repo.findAllSuperAdmins();
    }

    async findSuperRole(uid: number) {
        return this.repo.findSuperRole(uid);
    }

    async makeSuperAdmin(uid: number, role: string) {
        await this.repo.makeSuperAdmin(uid, role);
    }

    async makeNormalUser(uid: number) {
        await this.repo.makeNormalUser(uid);
    }

    start = () => {
        // Nothing to do
    }
}