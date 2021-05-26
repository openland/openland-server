import { RemoteStream } from './../repositories/EndStreamDirectory';
import { Context } from '@openland/context';
import { Subspace, TupleItem, encoders } from '@openland/foundationdb';
import { Capabilities } from 'openland-module-calls/repositories/CallScheduler';
import { Store } from 'openland-module-db/FDB';
import { EndStreamDirectory } from 'openland-module-calls/repositories/EndStreamDirectory';
import { DtlsParameters, IceCandidate, IceParameters, RtpParameters } from 'mediakitchen-common';

type PeerCollection = 'speaker' | 'listener' | 'producer' | 'main';

const peerCollectionMap: { [key in PeerCollection]: number } = {
    'speaker': 0,
    'listener': 1,
    'producer': 2,
    'main': 3
};

export type TransportSDP = {
    mid: string,
    port: number,
    parameters: RtpParameters,
    fingerprints: { algorithm: string, value: string }[]
};

export type ShardProducer = {
    pid: number;
    transportId: string;
    remote: boolean;
    producerId: string;
    parameters: RtpParameters;
};

export type ConsumerEdge = { pid: number, consumerId: string, producerId: string, parameters: RtpParameters };

export type ShardConsumer = {
    pid: number;
    uuid: string;
    capabilities: Capabilities;
    transport: {
        id: string;
        iceCandates: IceCandidate[];
        iceParameters: IceParameters;
        dtlsParameters: DtlsParameters;
        connected: boolean;
        connectedTo: ConsumerEdge[];
    } | null;
};

export class ScalableRepository {

    readonly endStreamDirectory = new EndStreamDirectory(Store.EndStreamDirectory);

    readonly peersSubspace: Subspace<TupleItem[], boolean>;

    // Shard Allocations
    readonly shardRefs: Subspace<TupleItem[], string>;
    readonly shardDeleted: Subspace<TupleItem[], boolean>;

    // Shards
    readonly endStreamShards: Subspace<TupleItem[], TupleItem[]>;
    readonly transportSdp: Subspace<TupleItem[], TransportSDP>;
    readonly shardProducers: Subspace<TupleItem[], ShardProducer>;
    readonly shardConsumers: Subspace<TupleItem[], ShardConsumer>;

    // Peer 
    readonly capabilities: Subspace<TupleItem[], Capabilities>;

    constructor() {
        this.peersSubspace = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean)
            .subspace([1]);
        this.capabilities = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace([3]);
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
        this.transportSdp = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace([12]);
        this.shardProducers = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace([13]);
        this.shardConsumers = Store.ConferenceScalableStateDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace([14]);
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

    setTransportSDP(ctx: Context, cid: number, session: string, shard: string, pid: number, tid: string, parameters: TransportSDP) {
        this.transportSdp.set(ctx, [cid, session, shard, pid, tid], parameters);
    }

    getTransportSdp(ctx: Context, cid: number, session: string, shard: string, pid: number, tid: string) {
        return this.transportSdp.get(ctx, [cid, session, shard, pid, tid]);
    }

    //
    // Consumers
    //

    setShardConsumer(ctx: Context, cid: number, session: string, shard: string, pid: number, consumer: ShardConsumer) {
        this.shardConsumers.set(ctx, [cid, session, shard, pid], consumer);
    }

    getShardConsumer(ctx: Context, cid: number, session: string, shard: string, pid: number) {
        return this.shardConsumers.get(ctx, [cid, session, shard, pid]);
    }

    removeShardConsumer(ctx: Context, cid: number, session: string, shard: string, pid: number) {
        this.shardConsumers.clear(ctx, [cid, session, shard, pid]);
    }

    async getShardConsumers(ctx: Context, cid: number, session: string, shard: string) {
        return (await this.shardConsumers.range(ctx, [cid, session, shard])).map((v) => v.value);
    }

    //
    // Producers
    //

    addProducerToShard(ctx: Context, cid: number, session: string, shard: string, pid: number, remote: boolean, transportId: string, producerId: string, parameters: RtpParameters) {
        this.shardProducers.set(ctx, [cid, session, shard, producerId], {
            pid,
            transportId,
            remote,
            producerId,
            parameters
        });
    }

    async getShardProducers(ctx: Context, cid: number, session: string, shard: string) {
        return (await this.shardProducers.range(ctx, [cid, session, shard])).map((v) => v.value);
    }

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

    createConsumerEndStream(ctx: Context, cid: number, session: string, shard: string, pid: number, id: string, sdp: string, remoteStreams: { pid: number, media: RemoteStream }[]) {
        this.endStreamShards.set(ctx, [id], [cid, session, shard]);
        this.endStreamDirectory.createStream(ctx, id, {
            pid,
            seq: 1,
            state: 'need-answer',
            localCandidates: [],
            remoteCandidates: [],
            localSdp: null,
            remoteSdp: JSON.stringify({ type: 'offer', sdp }),
            localStreams: [],
            remoteStreams: remoteStreams,
            iceTransportPolicy: 'all'
        });
    }

    updateConsumerEndStream(ctx: Context, id: string, sdp: string, remoteStreams: { pid: number, media: RemoteStream }[]) {
        this.endStreamDirectory.incrementSeq(ctx, id, 1);
        this.endStreamDirectory.updateStream(ctx, id, {
            state: 'need-answer',
            remoteStreams,
            remoteSdp: JSON.stringify({ type: 'offer', sdp })
        });
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
            iceTransportPolicy: 'all'
        });
    }

    answerProducerEndStream(ctx: Context, id: string, sdp: string) {
        this.endStreamDirectory.incrementSeq(ctx, id, 1);
        this.endStreamDirectory.updateStream(ctx, id, {
            state: 'online',
            remoteSdp: JSON.stringify({ type: 'answer', sdp })
        });
    }

    completeEndStream(ctx: Context, id: string) {
        this.endStreamDirectory.incrementSeq(ctx, id, 1);
        this.endStreamDirectory.updateStream(ctx, id, {
            state: 'completed',
        });
    }
}