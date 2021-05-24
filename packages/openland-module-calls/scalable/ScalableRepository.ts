import { Context } from '@openland/context';
import { Subspace, TupleItem, encoders } from '@openland/foundationdb';
import { Capabilities } from 'openland-module-calls/repositories/CallScheduler';
import { Store } from 'openland-module-db/FDB';
import { EndStreamDirectory } from 'openland-module-calls/repositories/EndStreamDirectory';

type PeerCollection = 'speaker' | 'listener' | 'producer' | 'main';

const peerCollectionMap: { [key in PeerCollection]: number } = {
    'speaker': 0,
    'listener': 1,
    'producer': 2,
    'main': 3
};

export class ScalableRepository {

    readonly endStreamDirectory = new EndStreamDirectory(Store.EndStreamDirectory);
    readonly sessions: Subspace<TupleItem[], boolean>;
    readonly peersSubspace: Subspace<TupleItem[], boolean>;
    readonly producers: Subspace<TupleItem[], boolean>;

    // Shard Allocations
    readonly shards: Subspace<TupleItem[], number>;
    readonly shardPeers: Subspace<TupleItem[], boolean>;
    readonly shardRefs: Subspace<TupleItem[], string>;
    readonly shardDeleted: Subspace<TupleItem[], boolean>;
    readonly peerShards: Subspace<TupleItem[], string>;

    // Shards
    readonly endStreamShards: Subspace<TupleItem[], TupleItem[]>;

    // Peer 
    readonly capabilities: Subspace<TupleItem[], Capabilities>;

    constructor() {
        this.sessions = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([0]);
        this.peersSubspace = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([1]);
        this.capabilities = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace([3]);
        this.producers = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([4]);
        this.shards = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int16LE)
            .subspace([11]);
        this.shardPeers = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([6]);
        this.peerShards = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.string)
            .subspace([7]);
        this.endStreamShards = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.tuple)
            .subspace([8]);
        this.shardRefs = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.string)
            .subspace([9]);
        this.shardDeleted = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([10]);
    }

    //
    // Peers
    //

    addPeersNoCheck(ctx: Context, cid: number, pids: number[], collection: PeerCollection) {
        for (let p of pids) {
            this.peersSubspace.set(ctx, [cid, peerCollectionMap[collection], p], true);
        }
        Store.ConferenceScalablePeersCount.add(ctx, cid, peerCollectionMap[collection], pids.length);
    }

    removePeersNoCheck(ctx: Context, cid: number, pids: number[], collection: PeerCollection) {
        for (let p of pids) {
            this.peersSubspace.clear(ctx, [cid, peerCollectionMap[collection], p]);
        }
        Store.ConferenceScalablePeersCount.add(ctx, cid, peerCollectionMap[collection], -pids.length);
    }

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
    // Shards
    //

    async getShards(ctx: Context, cid: number, sid: string) {
        let res = await this.shards.range(ctx, [cid, sid]);
        return res.map((v) => ({
            session: v.key[v.key.length - 3] as string,
            kind: v.key[v.key.length - 2] === 0 ? 'producers' : 'consumers' as ('producers' | 'consumers'),
            shard: v.key[v.key.length - 1] as string,
            count: v.value
        }));
    }

    addShard(ctx: Context, cid: number, sid: string, shard: string, kind: 'producers' | 'consumers') {
        this.shards.set(ctx, [cid, sid, kind === 'producers' ? 0 : 1, shard], 0);
    }

    addPeerToShard(ctx: Context, cid: number, sid: string, shard: string, kind: 'producers' | 'consumers', pid: number) {
        this.shards.add(ctx, [cid, sid, kind === 'producers' ? 0 : 1, shard], 1);
        this.shardPeers.set(ctx, [cid, sid, kind, shard, pid], true);
    }

    removePeerFromShard(ctx: Context, cid: number, sid: string, shard: string, kind: 'producers' | 'consumers', pid: number) {
        this.shards.add(ctx, [cid, sid, kind === 'producers' ? 0 : 1, shard], -1);
        this.shardPeers.clear(ctx, [cid, sid, kind, shard, pid]);
    }

    setPeerShardReference(ctx: Context, cid: number, sid: string, kind: 'producers' | 'consumers', pid: number, shard: string) {
        this.peerShards.set(ctx, [cid, sid, kind === 'producers' ? 0 : 1, pid], shard);
    }

    getPeerShardReference(ctx: Context, cid: number, sid: string, kind: 'producers' | 'consumers', pid: number) {
        return this.peerShards.get(ctx, [cid, sid, kind === 'producers' ? 0 : 1, pid]);
    }

    clearShards(ctx: Context, cid: number, sid: string) {
        this.shards.clearPrefixed(ctx, [cid, sid]);
        this.shardPeers.clearPrefixed(ctx, [cid, sid]);
        this.peerShards.clearPrefixed(ctx, [cid, sid]);
    }

    //
    // Shard
    //

    markDeleted(ctx: Context, cid: number, session: string, shard: string) {
        this.shardDeleted.set(ctx, [cid, session, shard], true);
    }

    async isShardDeleted(ctx: Context, cid: number, session: string, shard: string) {
        return !!(await this.shardDeleted.get(ctx, [cid, session, shard]));
    }

    //
    // Router
    //

    async getShardWorkerId(ctx: Context, cid: number, session: string, shard: string) {
        return await this.shardRefs.get(ctx, [cid, session, shard, 0]);
    }

    setShardWorkerId(ctx: Context, cid: number, session: string, shard: string, id: string) {
        this.shardRefs.set(ctx, [cid, session, shard, 0], id);
    }

    async getShardRouterId(ctx: Context, cid: number, session: string, shard: string) {
        return await this.shardRefs.get(ctx, [cid, session, shard, 1]);
    }

    setShardRouterId(ctx: Context, cid: number, session: string, shard: string, id: string) {
        this.shardRefs.set(ctx, [cid, session, shard, 1], id);
    }

    //
    // Producers
    //

    setProducerTransport(ctx: Context, cid: number, session: string, shard: string, pid: number, id: string) {
        this.shardRefs.set(ctx, [cid, session, shard, 2, pid], id);
    }

    getProducerTransport(ctx: Context, cid: number, session: string, shard: string, pid: number) {
        return this.shardRefs.get(ctx, [cid, session, shard, 2, pid]);
    }

    // addSessionRouterProducer(ctx: Context, cid: number, sid: string, producer: string) {
    //     this.producers.set(ctx, [cid, sid, producer], true);
    // }

    // removeSessionRouterProducer(ctx: Context, cid: number, sid: string, producer: string) {
    //     this.producers.set(ctx, [cid, sid, producer], false);
    // }

    // async getSessionProducers(ctx: Context, cid: number, sid: string) {
    //     return (await this.producers.range(ctx, [cid, sid])).map((v) => ({ id: v.key[v.key.length - 1] as string, active: v.value }));
    // }

    //
    // Streams
    //

    async getStreamShard(ctx: Context, id: string) {
        let ref = await this.endStreamShards.get(ctx, [id]);
        if (!ref) {
            return null;
        }
        return {
            cid: ref[0] as number,
            session: ref[1] as string,
            shard: ref[2] as string
        };
    }

    createProducerEndStream(ctx: Context, cid: number, session: string, shard: string, pid: number, id: string) {
        this.endStreamShards.set(ctx, [id], [cid, session, shard]);
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

    answerProducerEndStream(ctx: Context, id: string, sdp: string) {
        this.endStreamDirectory.incrementSeq(ctx, id, 1);
        this.endStreamDirectory.updateStream(ctx, id, {
            state: 'online',
            remoteSdp: JSON.stringify({ type: 'answer', sdp })
        });
    }
}