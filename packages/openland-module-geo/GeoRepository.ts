import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { injectable } from 'inversify';
import { UserLocationUpdatedEvent } from '../openland-module-db/store';
import { InvalidInputError } from '../openland-errors/InvalidInputError';

export type GeoLocation = {
    long: number;
    lat: number;
};

@injectable()
export class GeoRepository {
    public reportGeo(parent: Context, uid: number, tid: string, date: number, location: GeoLocation) {
        return inTx(parent, async ctx => {
            let geo = await this.getUserGeo(ctx, uid);
            let fifteenMinutesAgo = date - 1000 * 60 * 15;
            if (date > Date.now() || date < fifteenMinutesAgo) {
                throw new InvalidInputError([{ key: 'date', message: 'Date is not synchronized' }]);
            }

            geo.lastLocations.unshift({
                date,
                location,
                tid
            });
            geo.lastLocations.sort((a, b) => b.date - a.date);
            geo.invalidate();
            await geo.flush(ctx);

            Store.UserLocationEventStore.post(ctx, uid, UserLocationUpdatedEvent.create({
                date,
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