import { Context } from '@openland/context';
import { Subspace, TupleItem, encoders } from '@openland/foundationdb';
import { Capabilities } from 'openland-module-calls/repositories/CallScheduler';
import { Store } from 'openland-module-db/FDB';

export class ScalableRepository {

    readonly peersSubspace: Subspace<TupleItem[], boolean>;
    readonly ids: Subspace<TupleItem[], string>;
    readonly capabilities: Subspace<TupleItem[], Capabilities>;

    constructor() {
        this.peersSubspace = Store.ConferenceScalablePeersDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([0]);
        this.ids = Store.ConferenceScalablePeersDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.string)
            .subspace([1]);
        this.capabilities = Store.ConferenceScalablePeersDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace([2]);
    }

    //
    // Peers
    //

    async addPeer(ctx: Context, cid: number, pid: number, speaker: boolean): Promise<{ wasAdded: boolean }> {
        if (await this.peersSubspace.get(ctx, [cid, speaker, pid])) {
            return { wasAdded: false };
        }
        this.peersSubspace.set(ctx, [cid, speaker, pid], true);
        Store.ConferenceScalablePeersCount.add(ctx, cid, speaker ? 0 : 1, 1);
        return { wasAdded: true };
    }

    async removePeer(ctx: Context, cid: number, pid: number, speaker: boolean): Promise<{ wasRemoved: boolean }> {
        if (!(await this.peersSubspace.get(ctx, [cid, speaker, pid]))) {
            return { wasRemoved: false };
        }
        this.peersSubspace.clear(ctx, [cid, speaker, pid]);
        Store.ConferenceScalablePeersCount.add(ctx, cid, speaker ? 0 : 1, -1);
        return { wasRemoved: true };
    }

    getPeersCount(ctx: Context, cid: number, speaker: boolean) {
        return Store.ConferenceScalablePeersCount.get(ctx, cid, speaker ? 0 : 1);
    }

    async getPeers(ctx: Context, cid: number, speaker: boolean) {
        let peers = await this.peersSubspace.range(ctx, [cid, speaker]);
        return peers.map((v) => v.key[v.key.length - 1] as number);
    }

    getPeerCapabilities(ctx: Context, cid: number, pid: number): Promise<Capabilities | null> {
        return this.capabilities.get(ctx, [cid, pid]);
    }

    setPeerCapabilities(ctx: Context, cid: number, pid: number, capabilities: Capabilities | null) {
        if (capabilities) {
            this.capabilities.set(ctx, [cid, pid], capabilities);
        } else {
            this.capabilities.clear(ctx, [cid, pid]);
        }
    }

    //
    // Router
    //

    async getProducerWorkerId(ctx: Context, cid: number) {
        return await this.ids.get(ctx, [cid, 0]);
    }

    setProducerWorkerId(ctx: Context, cid: number, id: string | null) {
        if (id) {
            this.ids.set(ctx, [cid, 0], id);
        } else {
            this.ids.clear(ctx, [cid, 0]);
        }
    }

    async getProducerRouterId(ctx: Context, cid: number) {
        return await this.ids.get(ctx, [cid, 1]);
    }

    setProducerRouterId(ctx: Context, cid: number, id: string | null) {
        if (id) {
            this.ids.set(ctx, [cid, 1], id);
        } else {
            this.ids.clear(ctx, [cid, 1]);
        }
    }

    setSpeakerProducerTransport(ctx: Context, cid: number, pid: number, id: string | null) {
        if (id) {
            this.ids.set(ctx, [cid, 2, pid], id);
        } else {
            this.ids.clear(ctx, [cid, 2, pid]);
        }
    }

    async getSpeakerProducerTransport(ctx: Context, cid: number, pid: number) {
        return await this.ids.get(ctx, [cid, 2, pid]);
    }
}