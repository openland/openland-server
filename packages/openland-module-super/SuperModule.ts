import { SuperRepository } from './repositories/SuperRepository';
import { FDB } from 'openland-module-db/FDB';
import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';

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
        let reader = new UpdateReader('super-admin-exporter', 1, DB.SuperAdmin);
        reader.processor(async (items) => {
            for (let i = 0; i < items.length; i++) {
                this.repo.makeSuperAdmin(items[i].userId!, items[i].role || 'super-admin');
            }
        });
        reader.start();
    }
}