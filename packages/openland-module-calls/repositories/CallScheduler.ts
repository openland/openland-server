import { GQL } from 'openland-module-api/schema/SchemaSpec';
import { Context } from '@openland/context';

export interface MediaSources {
    audioStream: boolean;
    videoStream: boolean;
    screenCastStream: boolean;
}

export type ProducerDescriptor = {
    type: 'audio',
    codec: 'default' | 'opus'
    mid: string | null
} | {
    type: 'video',
    source: 'default' | 'screen',
    codec: 'default' | 'h264',
    mid: string | null
};

export type ConsumerDescriptor = {
    pid: number,
    media:
    | { type: 'audio', mid: string | null | undefined }
    | { type: 'video', source: 'default' | 'screen', mid: string | null | undefined }
};

export type ProducerReference = {
    pid: number,
    connection: string,
    producer: string,
    media:
    | { type: 'audio', mid: string | null | undefined }
    | { type: 'video', source: 'default' | 'screen', mid: string | null | undefined }
};

export type ConsumerReference = { media: { type: 'audio', mid: string | null | undefined } | { type: 'video', source: 'default' | 'screen', mid: string | null | undefined }, consumer: string, connection: string };

export type StreamHint = {
    peerId: number | null;
    kind: GQL.MediaKind;
    videoSource: GQL.VideoSource | null;
    direction: GQL.MediaDirection;
    mid: string;
};

export type Capabilities = {
    codecs: {
        kind: string;
        mimeType: string;
        preferredPayloadType: number;
        clockRate: number;
        channels: number | null;
        parameters: { key: string, value: string }[];
        rtcpFeedback: { type: string; value: string | null; }[];
    }[];
    headerExtensions: {
        kind: string;
        uri: string;
        preferredId: number;
    }[];
};

export interface CallScheduler {

    readonly supportsCandidates: boolean;

    onPeerRemoved(ctx: Context, cid: number, pid: number): Promise<void>;
    onPeerStreamsChanged(ctx: Context, cid: number, pid: number, sources: MediaSources): Promise<void>;
    onPeerAdded(ctx: Context, cid: number, pid: number, sources: MediaSources, capabilities: Capabilities, role: 'speaker' | 'listener'): Promise<void>;
    onPeerRoleChanged(ctx: Context, cid: number, pid: number, role: 'speaker' | 'listener'): Promise<void>;

    onStreamCandidate(ctx: Context, cid: number, pid: number, sid: string, candidate: string): Promise<void>;
    onStreamOffer(ctx: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null): Promise<void>;
    onStreamAnswer(ctx: Context, cid: number, pid: number, sid: string, answer: string): Promise<void>;
    onStreamFailed(ctx: Context, cid: number, pid: number, sid: string): Promise<void>;
}