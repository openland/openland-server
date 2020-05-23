import { GeoLocation, GeoRepository } from './GeoRepository';
import { injectable, inject } from 'inversify';
import { Context } from '@openland/context';
import { GeoMediator } from './GeoMediator';
import { PermissionRequestInfo } from '../openland-module-permissions/PermissionsRepository';

@injectable()
export class GeoModule {
    @inject('GeoMediator')
    private readonly mediator!: GeoMediator;

    @inject('GeoRepository')
    private readonly repo!: GeoRepository;

    public start = async () => {
        //
    }

    public reportGeo(parent: Context, uid: number, location: GeoLocation) {
        return this.mediator.reportGeo(parent, uid, location);
    }

    public getUserGeo(parent: Context, uid: number, info: PermissionRequestInfo) {
        return this.mediator.getUserGeo(parent, uid, info);
    }

    public getUserGeoUnsafe(parent: Context, uid: number) {
        return this.repo.getUserGeo(parent, uid);
    }

    public async shouldShareLocation(ctx: Context, uid: number) {
        return this.mediator.shouldShareLocation(ctx, uid);
    }
}