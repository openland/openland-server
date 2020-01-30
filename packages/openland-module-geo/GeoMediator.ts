import { inject, injectable } from 'inversify';
import { GeoLocation, GeoRepository } from './GeoRepository';
import { Context } from '@openland/context';
import { Modules } from '../openland-modules/Modules';
import { PermissionRequestInfo, Permissions } from '../openland-module-permissions/PermissionsRepository';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

@injectable()
export class GeoMediator {
    @inject('GeoRepository')
    private readonly repo!: GeoRepository;

    public async reportGeo(parent: Context, uid: number, tid: string, date: number, location: GeoLocation) {
        if (!await Modules.Permissions.hasSomethingGranted(parent, uid, Permissions.LOCATION)) {
            throw new AccessDeniedError();
        }

        return this.repo.reportGeo(parent, uid, tid, date, location);
    }

    public  async getUserGeo(parent: Context, uid: number, info: PermissionRequestInfo) {
        if (!await Modules.Permissions.isGranted(parent, info)) {
            return null;
        }
        return this.repo.getUserGeo(parent, uid);
    }

    public async shouldShareLocation(ctx: Context, uid: number) {
        return await Modules.Permissions.hasSomethingGranted(ctx, uid, Permissions.LOCATION);
    }
}