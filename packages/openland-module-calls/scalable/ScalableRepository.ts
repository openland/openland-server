import { Context } from '@openland/context';
import { Subspace } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { randomKey } from 'openland-utils/random';

export class ScalableRepository {

    readonly subspace: Subspace<Buffer, Buffer>;

    constructor() {
        this.subspace = Store.ConferenceScalableDirectory;
    }

    //
    // Peers
    //

    async addPeer(ctx: Context, cid: number, pid: number): Promise<{ wasStarted: boolean, wasAdded: boolean }> {

        // Check if added
        if (await Store.ConferenceScalablePeers.get(ctx, cid, pid)) {
            return { wasStarted: false, wasAdded: false };
        }

        // Add
        Store.ConferenceScalablePeers.set(ctx, cid, pid, true);
        Store.ConferenceScalablePeersCount.add(ctx, cid, 1);

        // Check if first peer
        let started = await Store.ConferenceScalableStarted.get(ctx, cid);
        if (!started) {
            Store.ConferenceScalableStarted.set(ctx, cid, true);
            return { wasStarted: true, wasAdded: true };
        }
        return { wasStarted: false, wasAdded: true };
    }

    async removePeer(ctx: Context, cid: number, pid: number): Promise<{ wasStopped: boolean, wasRemoved: boolean }> {

        // Check if added
        if (!(await Store.ConferenceScalablePeers.get(ctx, cid, pid))) {
            return { wasStopped: false, wasRemoved: false };
        }

        // Remove
        Store.ConferenceScalablePeers.set(ctx, cid, pid, false);
        Store.ConferenceScalablePeersCount.add(ctx, cid, -1);

        // Check if last
        let started = await Store.ConferenceScalableStarted.get(ctx, cid);
        if (await Store.ConferenceScalablePeersCount.get(ctx, cid) === 0) {
            if (started) {
                Store.ConferenceScalableStarted.set(ctx, cid, false);
                return { wasStopped: true, wasRemoved: true };
            }
        }
        return { wasStopped: false, wasRemoved: true };
    }

    //
    // Routers
    //

    async createRouter(ctx: Context, cid: number) {
        return randomKey();
    }

    async deleteRouter(ctx: Context, cid: number, key: string) {
        // TODO: Implement
    }
}