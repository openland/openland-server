import { SuperRepository } from './repositories/SuperRepository';
import { FDB } from 'openland-module-db/FDB';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startAdminInterface } from './startAdminInterface';
import { PermissionsRepository } from './repositories/PermissionsRepository';
import { injectable } from 'inversify';
import { Context } from 'openland-utils/Context';

@injectable()
export class SuperModule {
    private readonly repo = new SuperRepository(FDB);
    private readonly permissionsRepo = new PermissionsRepository(FDB);

    async findAllSuperAdmins(ctx: Context) {
        return this.repo.findAllSuperAdmins(ctx);
    }

    async findSuperRole(ctx: Context, uid: number) {
        return this.repo.findSuperRole(ctx, uid);
    }

    async makeSuperAdmin(ctx: Context, uid: number, role: string) {
        await this.repo.makeSuperAdmin(ctx, uid, role);
    }

    async makeNormalUser(ctx: Context, uid: number) {
        await this.repo.makeNormalUser(ctx, uid);
    }

    async calculateStats(ctx: Context) {
        return ({
            messages: (await FDB.Sequence.findById(ctx, 'message-id'))!.value
        });
    }

    async resolvePermissions(ctx: Context, args: { uid: number | null | undefined, oid: number | null | undefined }) {
        return this.permissionsRepo.resolvePermissions(ctx, args);
    }

    async superRole(ctx: Context, userId: number | null | undefined) {
        return this.permissionsRepo.superRole(ctx, userId);
    }

    start = () => {
        if (serverRoleEnabled('admin')) {
            startAdminInterface();
        }
    }
}