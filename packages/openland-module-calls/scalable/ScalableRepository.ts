import { Context } from '@openland/context';
import { Subspace, TupleItem, encoders } from '@openland/foundationdb';
import { Capabilities } from 'openland-module-calls/repositories/CallScheduler';
import { KitchenRtpCapabilities } from '../kitchen/types';
import { Store } from 'openland-module-db/FDB';
import { EndStreamDirectory } from 'openland-module-calls/repositories/EndStreamDirectory';

type PeerCollection = 'speaker' | 'listener' | 'producer';

const peerCollectionMap: { [key in PeerCollection]: number } = {
    'speaker': 0,
    'listener': 1,
    'producer': 2
};

export class ScalableRepository {

    readonly endStreamDirectory = new EndStreamDirectory(Store.EndStreamDirectory);
    readonly sessions: Subspace<TupleItem[], boolean>;
    readonly peersSubspace: Subspace<TupleItem[], boolean>;
    readonly ids: Subspace<TupleItem[], string>;
    readonly producers: Subspace<TupleItem[], boolean>;
    readonly capabilities: Subspace<TupleItem[], Capabilities>;
    readonly rtpCapabilities: Subspace<TupleItem[], KitchenRtpCapabilities>;

    constructor() {
        this.sessions = Store.ConferenceScalablePeersDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([0]);
        this.peersSubspace = Store.ConferenceScalablePeersDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([1]);
        this.ids = Store.ConferenceScalablePeersDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.string)
            .subspace([2]);
        this.capabilities = Store.ConferenceScalablePeersDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace([3]);
        this.producers = Store.ConferenceScalablePeersDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([4]);
        this.rtpCapabilities = Store.ConferenceScalablePeersDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace([5]);
    }

    //
    // Peers
    //

    async addPeer(ctx: Context, cid: number, pid: number, collection: PeerCollection): Promise<{ wasAdded: boolean }> {
        if (await this.peersSubspace.get(ctx, [cid, peerCollectionMap[collection], pid])) {
            return { wasAdded: false };
        }
        this.peersSubspace.set(ctx, [cid, peerCollectionMap[collection], pid], true);
        Store.ConferenceScalablePeersCount.add(ctx, cid, peerCollectionMap[collection], 1);
        return { wasAdded: true };
    }

    async removePeer(ctx: Context, cid: number, pid: number, collection: PeerCollection): Promise<{ wasRemoved: boolean }> {
        if (!(await this.peersSubspace.get(ctx, [cid, peerCollectionMap[collection], pid]))) {
            return { wasRemoved: false };
        }
        this.peersSubspace.clear(ctx, [cid, peerCollectionMap[collection], pid]);
        Store.ConferenceScalablePeersCount.add(ctx, cid, peerCollectionMap[collection], -1);
        return { wasRemoved: true };
    }

    getPeersCount(ctx: Context, cid: number, collection: PeerCollection) {
        return Store.ConferenceScalablePeersCount.get(ctx, cid, peerCollectionMap[collection]);
    }

    async getPeers(ctx: Context, cid: number, collection: PeerCollection) {
        let peers = await this.peersSubspace.range(ctx, [cid, peerCollectionMap[collection]]);
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
    // Session
    //

    async getCallSessions(ctx: Context, cid: number) {
        let res = await this.sessions.range(ctx, [cid]);
        return res.map((s) => ({ id: s.key[s.key.length - 1] as string, active: s.value }));
    }

    async getActiveSession(ctx: Context, cid: number) {
        let all = await this.getCallSessions(ctx, cid);
        let id: string | null = null;
        for (let a of all) {
            if (a.active) {
                if (id) {
                    throw Error('Internal inconsistency');
                }
                id = a.id;
            }
        }
        return id;
    }

    /**
     * Stop media session
     */
    async sessionStop(ctx: Context, cid: number, id: string) {
        let ex = await this.sessions.get(ctx, [cid, id]);
        if (ex) {
            this.sessions.set(ctx, [cid, id], false);
            return true;
        }
        return false;
    }

    async sessionCreate(ctx: Context, cid: number, id: string) {
        let s = await this.sessions.get(ctx, [cid, id]);
        if (s !== null) {
            return false;
        }
        let ex = await this.getActiveSession(ctx, cid);
        if (ex) {
            throw Error('Unable to have multiple active sessions');
        }
        this.sessions.set(ctx, [cid, id], true);
        return true;
    }

    async sessionDelete(ctx: Context, cid: number, id: string) {
        let ex = await this.sessions.get(ctx, [cid, id]);
        if (ex === true) {
            throw Error('Session must be stopped first');
        } else if (ex === false) {
            this.sessions.clear(ctx, [cid, id]);
        }
    }

    //
    // Router
    //

    async getSessionWorkerId(ctx: Context, cid: number, sid: string) {
        return await this.ids.get(ctx, [cid, sid, 0]);
    }

    setSessionWorkerId(ctx: Context, cid: number, sid: string, id: string) {
        this.ids.set(ctx, [cid, sid, 0], id);
    }

    async getSessionRouterId(ctx: Context, cid: number, sid: string) {
        return await this.ids.get(ctx, [cid, sid, 1]);
    }

    setSessionRouterId(ctx: Context, cid: number, sid: string, id: string | null) {
        if (id) {
            this.ids.set(ctx, [cid, sid, 1], id);
        } else {
            this.ids.clear(ctx, [cid, sid, 1]);
        }
    }

    //
    // Producers
    //

    setProducerTransport(ctx: Context, cid: number, pid: number, sid: string, id: string | null) {
        if (id) {
            this.ids.set(ctx, [cid, sid, 2, pid], id);
        } else {
            this.ids.clear(ctx, [cid, sid, 2, pid]);
        }
    }

    async getProducerTransport(ctx: Context, cid: number, pid: number, sid: string) {
        return await this.ids.get(ctx, [cid, sid, 2, pid]);
    }

    addSessionRouterProducer(ctx: Context, cid: number, sid: string, producer: string) {
        this.producers.set(ctx, [cid, sid, producer], true);
    }

    removeSessionRouterProducer(ctx: Context, cid: number, sid: string, producer: string) {
        this.producers.set(ctx, [cid, sid, producer], false);
    }

    async getSessionProducers(ctx: Context, cid: number, sid: string) {
        return (await this.producers.range(ctx, [cid, sid])).map((v) => ({ id: v.key[v.key.length - 1] as string, active: v.value }));
    }

    //
    // Streams
    //

    createProducerEndStream(ctx: Context, pid: number, id: string) {
        this.endStreamDirectory.createStream(ctx, id, {
            pid,
            seq: 1,
            state: 'need-offer',
            localCandidates: [],
            remoteCandidates: [],
            localSdp: null,
            remoteSdp: null,
            localStreams: [{ type: 'audio', codec: 'opus', mid: null }],
            remoteStreams: [],
            iceTransportPolicy: 'relay'
        });
    }

    answerProducerEndStream(ctx: Context, pid: number, id: string, sdp: string) {
        this.endStreamDirectory.incrementSeq(ctx, id, 1);
        this.endStreamDirectory.updateStream(ctx, id, {
            state: 'online',
            remoteSdp: JSON.stringify({ type: 'answer', sdp })
        });
    }
}