import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { injectable } from 'inversify';
import { UserLocationUpdatedEvent } from '../openland-module-db/store';

export type GeoLocation = {
    long: number;
    lat: number;
};

@injectable()
export class GeoRepository {
    public reportGeo(parent: Context, uid: number, location: GeoLocation) {
        return inTx(parent, async ctx => {
            let geo = await this.getUserGeo(ctx, uid);
            geo.lastLocations.unshift({
                date: Date.now(),
                location
            });
            geo.isSharing = true;

            geo.invalidate();
            await geo.flush(ctx);

            Store.UserLocationEventStore.post(ctx, uid, UserLocationUpdatedEvent.create({
                date: Date.now(),
                uid
            }));
        });
    }

    public getUserGeo(parent: Context, uid: number) {
        return inTx(parent, async ctx => {
            let geo = await Store.UserLocation.findById(ctx, uid);
            if (!geo) {
                geo = await Store.UserLocation.create(ctx, uid, {
                    lastLocations: [],
                    isSharing: false
                });
            }
            if (geo.lastLocations.length > 0) {
                let date = Date.now();
                let fifteenMinutesAgo = date - 1000 * 60 * 15;

                geo.lastLocations = geo.lastLocations.filter(a => a.date >= fifteenMinutesAgo);
                await geo.flush(ctx);
            }
            return geo;
        });
    }
}