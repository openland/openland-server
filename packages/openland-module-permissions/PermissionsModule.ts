import { inject, injectable } from 'inversify';
import { Context } from '@openland/context';
import { PermissionRequestInfo, PermissionsRepository } from './PermissionsRepository';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';

@injectable()
export class PermissionsModule {
    @inject('PermissionsRepository')
    private readonly repo!: PermissionsRepository;

    start = () => {
        // no op
    }

    public isGranted(parent: Context, info: PermissionRequestInfo) {
        return this.repo.isGranted(parent, info);
    }

    public hasSomethingGranted(parent: Context, uid: number, gid: number) {
        return this.repo.hasSomethingGranted(parent, uid, gid);
    }

    public updatePermissionStatus(parent: Context, info: PermissionRequestInfo,  status: 'rejected' | 'granted') {
        return this.repo.updatePermissionStatus(parent, info, status);
    }

    public getGrantedPermissionsForApp(parent: Context, uid: number, appId: number, appType: string) {
        return this.repo.getGrantedPermissionsForApp(parent, uid, appId, appType);
    }

    public getWaitingPermissions(parent: Context, uid: number) {
        return this.repo.getWaitingPermissions(parent, uid);
    }

    public getUserPermissions(parent: Context, uid: number) {
        return this.repo.getUserPermissions(parent, uid);
    }

    public getPermissionGroups(parent: Context, uid: number) {
        return t;
    }
}