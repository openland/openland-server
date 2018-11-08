import { SuperRepository } from './repositories/SuperRepository';
import { FDB } from 'openland-module-db/FDB';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startAdminInterface } from './startAdminInterface';
import { PermissionsRepository } from './repositories/PermissionsRepository';

export class SuperModule {
    private readonly repo = new SuperRepository(FDB);
    private readonly permissionsRepo = new PermissionsRepository(FDB);

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

    async calculateStats() {
        return ({
            messages: (await FDB.Sequence.findById('message-id'))!.value
        });
    }

    async resolvePermissions(args: { uid: number | null | undefined, oid: number | null | undefined }) {
        return this.permissionsRepo.resolvePermissions(args);
    }

    async superRole(userId: number | null | undefined) {
        return this.permissionsRepo.superRole(userId);
    }

    start = () => {
        if (serverRoleEnabled('admin')) {
            startAdminInterface();
        }
    }
}