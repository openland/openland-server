import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';
import uuid from 'uuid';

export interface PermissionGroup {
    id: number;
    name: string;
    description: string;
}

const permissionGroups: PermissionGroup[] = [
    {
        id: 1,
        name: 'Location',
        description: 'Share your location for our services'
    }
];

export enum Permissions {
    LOCATION = 1
}

export type PermissionRequestInfo = {
    uid: number;
    gid: number;
    appType: 'powerup';
    appId: number;
    scopeType: 'global' | 'chat';
    scopeId?: number | null;
};

@injectable()
export class PermissionsRepository {
    public getPermissionStatus(parent: Context, info: PermissionRequestInfo) {
        const {
            uid, gid,
            appType, appId,
            scopeType,
            scopeId
        } = info;

        return inTx(parent, async ctx => {
            let request = await Store.PermissionRequest.single.find(ctx, uid, gid, appType, appId, scopeType, scopeId || null);
            if (!request) {
                request = await Store.PermissionRequest.create(ctx, uuid(), {
                    appId,
                    appType,
                    gid,
                    uid,
                    scopeType,
                    scopeId,
                    status: 'waiting',
                });
            }
            return request;
        });
    }

    public async isGranted(parent: Context, info: PermissionRequestInfo) {
        let permission = await this.getPermissionStatus(parent, info);
        return permission.status === 'granted';
    }

    public async hasSomethingGranted(parent: Context, uid: number, gid: number) {
        let permissions = await Store.PermissionRequest.userGroup.findAll(parent, uid, gid);
        return !!permissions.find(a => a.status === 'granted');
    }

    public updatePermissionStatus(parent: Context, info: PermissionRequestInfo,  status: 'rejected' | 'granted') {
        return inTx(parent, async ctx => {
           let permission = await this.getPermissionStatus(ctx, info);

           permission.status = status;
        });
    }

    public getGrantedPermissionsForApp(parent: Context, uid: number, appId: number, appType: 'powerup') {
        return inTx(parent, async ctx => {
           let permissions = await Store.PermissionRequest.userApp.findAll(ctx, uid, appType, appId);
           return permissions.filter(a => a.status === 'granted');
        });
    }

    public getWaitingPermissions(parent: Context, uid: number) {
        return inTx(parent, async ctx => {
            let userRequests = await Store.PermissionRequest.user.findAll(ctx, uid);
            return userRequests.filter(a => a.status === 'waiting');
        });
    }

    public getUserPermissions(parent: Context, uid: number) {
        return inTx(parent, async ctx => {
            return await Store.PermissionRequest.user.findAll(ctx, uid);
        });
    }

    public getPermissionsForGroup(parent: Context, uid: number, gid: number) {
        return inTx(parent, async ctx => {
            return await Store.PermissionRequest.userGroup.findAll(ctx, uid, gid);
        });
    }

    public getPermissionGroups(parent: Context) {
        return permissionGroups;
    }
}