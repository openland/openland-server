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

export type StreamHint = {
    peerId: number | null;
    kind: GQL.MediaKind;
    videoSource: GQL.VideoSource | null;
    direction: GQL.MediaDirection;
    mid: string;
};

export interface CallScheduler {
    onConferenceStarted(ctx: Context, cid: number): Promise<void>;
    onConferenceStopped(ctx: Context, cid: number): Promise<void>;

    onPeerRemoved(ctx: Context, cid: number, pid: number): Promise<void>;
    onPeerStreamsChanged(ctx: Context, cid: number, pid: number, sources: MediaSources): Promise<void>;
    onPeerAdded(ctx: Context, cid: number, pid: number, sources: MediaSources): Promise<void>;

    onStreamCandidate(ctx: Context, cid: number, pid: number, sid: string, candidate: string): Promise<void>;
    onStreamOffer(ctx: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null): Promise<void>;
    onStreamAnswer(ctx: Context, cid: number, pid: number, sid: string, answer: string): Promise<void>;
}