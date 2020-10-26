import { Versionstamp, VersionstampRef } from '@openland/foundationdb-tuple';
import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, TupleItem, encoders } from '@openland/foundationdb';

export class SubscriberUpdatesRepository {
    readonly subspace: Subspace<TupleItem[], TupleItem[]>;

    constructor(subspace: Subspace) {
        this.subspace = subspace
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.tuple);
    }

    async appendChanged(ctx: Context, subscriber: Buffer, feed: Buffer, vt: VersionstampRef) {
        this.subspace.setTupleKey(ctx, Locations.subscriber.subscriptionChanges.write(subscriber, vt), [feed]);
    }

    async getChanged(ctx: Context, subscriber: Buffer, after: Buffer) {
        let location = Locations.subscriber.subscriptionChanges.all(subscriber);
        let afterPacked = Locations.subscriber.subscriptionChanges.read(subscriber, new Versionstamp(after));
        let changed = (await this.subspace.range(ctx, location, { after: afterPacked })).map((v) => v.value);
        let res: Buffer[] = [];
        for (let ch of changed) {
            let feed = ch[0] as Buffer;
            if (res.find((v) => v.compare(feed) === 0)) {
                continue;
            }
            res.push(feed);
        }
        return res;
    }
}