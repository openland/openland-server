import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace } from '@openland/foundationdb';

export class SubscriberUpdatesRepository {
    private directory: Subspace;

    constructor(directory: Subspace) {
        this.directory = directory;
    }

    async appendChanged(ctx: Context, subscriber: Buffer, feed: Buffer, index: Buffer) {
        this.directory.setVersionstampedKey(ctx, Locations.subscriber.subscriptionChanges(subscriber), feed, index);
    }

    async getChanged(ctx: Context, subscriber: Buffer, after: Buffer) {
        let location = Locations.subscriber.subscriptionChanges(subscriber);
        let changed = (await this.directory.range(ctx, location, { after: Buffer.concat([location, after]) })).map((v) => v.value);
        let res: Buffer[] = [];
        for (let ch of changed) {
            if (res.find((v) => v.compare(ch) === 0)) {
                continue;
            }
            res.push(ch);
        }
        return res;
    }
}