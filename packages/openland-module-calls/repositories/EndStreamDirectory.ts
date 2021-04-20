import { encoders, Subspace } from '@openland/foundationdb';
import { Context } from '@openland/context';

const SUBSPACE_PEER_INDEX = 11;

const Subspaces = {
    pid: (id: string) => encoders.tuple.pack([id, 1]),
    state: (id: string) => encoders.tuple.pack([id, 2]),
    seq: (id: string) => encoders.tuple.pack([id, 3]),
    localStreams: (id: string) => encoders.tuple.pack([id, 4]),
    remoteStreams: (id: string) => encoders.tuple.pack([id, 5]),
    iceTransportPolicy: (id: string) => encoders.tuple.pack([id, 6]),
    localSdp: (id: string) => encoders.tuple.pack([id, 7]),
    remoteSdp: (id: string) => encoders.tuple.pack([id, 8]),
    localCandidates: (id: string) => encoders.tuple.pack([id, 9]),
    remoteCandidates: (id: string) => encoders.tuple.pack([id, 10]),

    // indexes
    peerIndex: (id: string, pid: number) => encoders.tuple.pack([SUBSPACE_PEER_INDEX, pid, id])
};

type LocalStream =
    { type: 'audio', codec: 'default' | 'opus', mid: string | null } |
    { type: 'video', codec: 'default' | 'h264', source: 'default' | 'screen', mid: string | null };

type RemoteStream =
    { type: 'audio', mid: string | null } |
    { type: 'video', source: 'default' | 'screen', mid: string | null };

export type StreamInput = {
    pid?: number
    seq?: number
    state?: 'need-offer' | 'wait-offer' | 'need-answer' | 'wait-answer' | 'online' | 'completed'
    localStreams?: LocalStream[]
    remoteStreams?: { pid: number, media: RemoteStream }[]
    iceTransportPolicy?: 'all' | 'relay' | 'none'
    localSdp?: string | null;
    remoteSdp?: string | null;
    localCandidates?: (string)[];
    remoteCandidates?: (string)[];
};

const ONE = Buffer.from([1]);

export class EndStreamDirectory {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    updateStream(ctx: Context, id: string, input: StreamInput) {
        // TODO: json validation via codecs

        if (input.pid !== undefined) {
            this.subspace.set(ctx, Subspaces.pid(id), encoders.int32LE.pack(input.pid));
            this.subspace.set(ctx, Subspaces.peerIndex(id, input.pid), ONE);
        }

        if (input.state !== undefined) {
            this.subspace.set(ctx, Subspaces.state(id), encoders.tuple.pack([input.state]));
        }

        if (input.seq !== undefined) {
            this.subspace.set(ctx, Subspaces.seq(id), encoders.int32LE.pack(input.seq));
        }

        if (input.localStreams !== undefined) {
            this.subspace.set(ctx, Subspaces.localStreams(id), encoders.json.pack(input.localStreams));
        }

        if (input.remoteStreams !== undefined) {
            this.subspace.set(ctx, Subspaces.remoteStreams(id), encoders.json.pack(input.remoteStreams));
        }

        if (input.iceTransportPolicy !== undefined) {
            this.subspace.set(ctx, Subspaces.iceTransportPolicy(id), encoders.tuple.pack([input.iceTransportPolicy]));
        }

        if (input.localSdp !== undefined) {
            this.subspace.set(ctx, Subspaces.localSdp(id), encoders.tuple.pack([input.localSdp]));
        }

        if (input.remoteSdp !== undefined) {
            this.subspace.set(ctx, Subspaces.remoteSdp(id), encoders.tuple.pack([input.remoteSdp]));
        }

        if (input.localCandidates !== undefined) {
            this.subspace.set(ctx, Subspaces.localCandidates(id), encoders.tuple.pack(input.localCandidates));
        }

        if (input.remoteCandidates !== undefined) {
            this.subspace.set(ctx, Subspaces.remoteCandidates(id), encoders.tuple.pack(input.remoteCandidates));
        }
    }

    createStream(ctx: Context, id: string, input: Required<StreamInput>) {
        this.updateStream(ctx, id, input);
    }

    incrementSeq(ctx: Context, id: string, by: number) {
        this.subspace.add(ctx, Subspaces.seq(id), encoders.int32LE.pack(by));
    }

    async getPid(ctx: Context, id: string): Promise<StreamInput['pid'] | null> {
        let pid = await this.subspace.get(ctx, Subspaces.pid(id));
        if (!pid) {
            return null;
        }
        return encoders.int32LE.unpack(pid);
    }

    async getState(ctx: Context, id: string): Promise<StreamInput['state'] | null> {
        let state = await this.subspace.get(ctx, Subspaces.state(id));
        if (!state) {
            return null;
        }
        return encoders.tuple.unpack(state)[0] as StreamInput['state'];
    }

    async getSeq(ctx: Context, id: string): Promise<StreamInput['seq'] | null> {
        let seq = await this.subspace.get(ctx, Subspaces.seq(id));
        if (!seq) {
            return null;
        }
        return encoders.int32LE.unpack(seq);
    }

    async getLocalStreams(ctx: Context, id: string): Promise<StreamInput['localStreams'] | null> {
        let localStreams = await this.subspace.get(ctx, Subspaces.localStreams(id));
        if (!localStreams) {
            return null;
        }

        return encoders.json.unpack(localStreams);
    }

    async getRemoteStreams(ctx: Context, id: string): Promise<StreamInput['remoteStreams'] | null> {
        let remoteStreams = await this.subspace.get(ctx, Subspaces.remoteStreams(id));
        if (!remoteStreams) {
            return null;
        }

        return encoders.json.unpack(remoteStreams);
    }

    async getIceTransportPolicy(ctx: Context, id: string): Promise<StreamInput['iceTransportPolicy'] | null> {
        let iceTransportPolicy = await this.subspace.get(ctx, Subspaces.iceTransportPolicy(id));
        if (!iceTransportPolicy) {
            return null;
        }

        return encoders.tuple.unpack(iceTransportPolicy)[0] as StreamInput['iceTransportPolicy'];
    }

    async getLocalSdp(ctx: Context, id: string): Promise<StreamInput['localSdp'] | null> {
        let localSdp = await this.subspace.get(ctx, Subspaces.localSdp(id));
        if (!localSdp) {
            return null;
        }

        return encoders.tuple.unpack(localSdp)[0] as StreamInput['localSdp'];
    }

    async getRemoteSdp(ctx: Context, id: string): Promise<StreamInput['remoteSdp'] | null> {
        let remoteSdp = await this.subspace.get(ctx, Subspaces.remoteSdp(id));
        if (!remoteSdp) {
            return null;
        }

        return encoders.tuple.unpack(remoteSdp)[0] as StreamInput['remoteSdp'];
    }

    async getLocalCandidates(ctx: Context, id: string): Promise<StreamInput['localCandidates'] | null> {
        let localCandidates = await this.subspace.get(ctx, Subspaces.localCandidates(id));
        if (!localCandidates) {
            return null;
        }

        return encoders.tuple.unpack(localCandidates) as StreamInput['localCandidates'];
    }

    async getRemoteCandidates(ctx: Context, id: string): Promise<StreamInput['remoteCandidates'] | null> {
        let remoteCandidates = await this.subspace.get(ctx, Subspaces.remoteCandidates(id));
        if (!remoteCandidates) {
            return null;
        }

        return encoders.tuple.unpack(remoteCandidates) as StreamInput['remoteCandidates'];
    }

    async getPeerStreams(ctx: Context, pid: number): Promise<string[]> {
        let res = await this.subspace.range(ctx, encoders.tuple.pack([SUBSPACE_PEER_INDEX, pid]));
        return res.map(i => encoders.tuple.unpack(i.key)[2] as string);
    }
}