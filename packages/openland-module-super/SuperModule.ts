import { SuperRepository } from './repositories/SuperRepository';
import { Store } from 'openland-module-db/FDB';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startAdminInterface } from './startAdminInterface';
import { PermissionsRepository } from './repositories/PermissionsRepository';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { EnvironmentVariablesRepository, EnvVarValueType } from './repositories/EnvironmentVariablesRepository';
import { createEntityCleaner } from '../openland-module-db/createEntityCleaner';
import { HyperLog, Task } from '../openland-module-db/store';

@injectable()
export class SuperModule {
    private readonly repo = new SuperRepository();
    private readonly permissionsRepo = new PermissionsRepository();
    private readonly envVarsRepo = new EnvironmentVariablesRepository();

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
            messages: (await Store.Sequence.findById(ctx, 'message-id'))!.value
        });
    }

    async resolvePermissions(ctx: Context, args: { uid: number | null | undefined, oid: number | null | undefined }) {
        return this.permissionsRepo.resolvePermissions(ctx, args);
    }

    async superRole(ctx: Context, userId: number | null | undefined) {
        return this.permissionsRepo.superRole(ctx, userId);
    }

    async isSuperAdmin(ctx: Context, uid: number) {
        return await this.permissionsRepo.superRole(ctx, uid) === 'super-admin';
    }

    async getEnvVar<T extends EnvVarValueType>(ctx: Context, name: string): Promise<T | null> {
        return this.envVarsRepo.get<T>(ctx, name);
    }

    async setEnvVar<T extends EnvVarValueType>(ctx: Context, name: string, value: T, rawValue: boolean = false) {
        return this.envVarsRepo.set<T>(ctx, name, value, rawValue);
    }

    start = async () => {
        if (serverRoleEnabled('admin')) {
            await startAdminInterface();
        }
        // createEntitiesCounter('HyperLog', 3, Store.HyperLog, 5000);
        // createEntitiesCounter('Task', 1, Store.Task, 5000);
        // createEntitiesCounter('Message', 1, Store.Message, 5000);

        createEntityCleaner<HyperLog>('HyperLog', 3, Store.HyperLog, 4000, (log) => log.date < 1562864071515 || log.type === 'track' || log.type === 'task_completed' ||  log.type === 'task_scheduled' || log.type === 'presence');
        createEntityCleaner<Task>('Task', 5, Store.Task, 4000, (task) => task.taskStatus === 'completed');
    }
}
