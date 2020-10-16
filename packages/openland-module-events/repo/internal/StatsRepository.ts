import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders } from '@openland/foundationdb';

type Counter = 'feeds' | 'subscribers' | 'subscriptions';

export class StatsRepository {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    async getCounter(ctx: Context, type: Counter) {
        let location = this.getCounterLocation(type);
        let ex = await this.subspace.get(ctx, location);
        if (!ex) {
            return 0;
        } else {
            return encoders.int32LE.unpack(ex);
        }
    }

    increment(ctx: Context, type: Counter) {
        let location = this.getCounterLocation(type);
        this.subspace.add(ctx, location, encoders.int32LE.pack(1));
    }

    decrement(ctx: Context, type: Counter) {
        let location = this.getCounterLocation(type);
        this.subspace.add(ctx, location, encoders.int32LE.pack(-1));
    }

    private getCounterLocation(type: Counter) {
        if (type === 'feeds') {
            return Locations.stats.feeds;
        } else if (type === 'subscribers') {
            return Locations.stats.subscribers;
        } else if (type === 'subscriptions') {
            return Locations.stats.subscriptions;
        }

        throw Error('Unknoen type: ' + type);
    }
}