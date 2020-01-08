import { GeoLocation, GeoRepository } from './GeoRepository';
import { injectable, inject } from 'inversify';
import { Context } from '@openland/context';

@injectable()
export class GeoModule {
    @inject('GeoRepository')
    private readonly repo!: GeoRepository;

    public reportGeo(parent: Context, uid: number, location: GeoLocation) {
        return this.repo.reportGeo(parent, uid, location);
    }

    public getUserGeo(parent: Context, uid: number) {
        return this.repo.getUserGeo(parent, uid);
    }

    public stopSharingGeo(parent: Context, uid: number) {
        return this.repo.stopSharingGeo(parent, uid);
    }
}