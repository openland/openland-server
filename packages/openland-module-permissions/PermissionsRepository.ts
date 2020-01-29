import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';
import uuid from 'uuid';
import { PermissionUpdatedEvent } from '../openland-module-db/store';

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
            let p = await Store.Permission.single.find(ctx, uid, gid, appType, appId, scopeType, scopeId || null);
            if (!p) {
                p = await Store.Permission.create(ctx, uuid(), {
                    appId,
                    appType,
                    gid,
                    uid,
                    scopeType,
                    scopeId,
                    status: 'waiting',
                });

                Store.PermissionEventStore.post(ctx, info.uid, PermissionUpdatedEvent.create({
                    id: p.id
                }));
            }
            return p;
        });
    }

    public async isGranted(parent: Context, info: PermissionRequestInfo) {
        let permission = await this.getPermissionStatus(parent, info);
        return permission.status === 'granted';
    }

    public async hasSomethingGranted(parent: Context, uid: number, gid: number) {
        let permissions = await Store.Permission.userGroup.findAll(parent, uid, gid);
        return !!permissions.find(a => a.status === 'granted');
    }

    public updatePermissionStatus(parent: Context, info: PermissionRequestInfo,  status: 'rejected' | 'granted') {
        return inTx(parent, async ctx => {
           let permission = await this.getPermissionStatus(ctx, info);
           permission.status = status;

           Store.PermissionEventStore.post(ctx, info.uid, PermissionUpdatedEvent.create({
               id: permission.id
           }));
        });
    }

    public getGrantedPermissionsForApp(parent: Context, uid: number, appId: number, appType: 'powerup') {
        return inTx(parent, async ctx => {
           let permissions = await Store.Permission.userApp.findAll(ctx, uid, appType, appId);
           return permissions.filter(a => a.status === 'granted');
        });
    }

    public getWaitingPermissions(parent: Context, uid: number) {
        return inTx(parent, async ctx => {
            let userRequests = await Store.Permission.user.findAll(ctx, uid);
            return userRequests.filter(a => a.status === 'waiting');
        });
    }

    public getUserPermissions(parent: Context, uid: number) {
        return inTx(parent, async ctx => {
            return await Store.Permission.user.findAll(ctx, uid);
        });
    }

    public getPermissionsForGroup(parent: Context, uid: number, gid: number) {
        return inTx(parent, async ctx => {
            return await Store.Permission.userGroup.findAll(ctx, uid, gid);
        });
    }

    public getPermissionGroups(parent: Context) {
        return permissionGroups;
    }
}