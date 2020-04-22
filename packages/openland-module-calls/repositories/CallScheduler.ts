import { Context } from '@openland/context';

export interface MediaSources {
    audioStream: boolean;
    videoStream: boolean;
    screenCastStream: boolean;
}

export type StreamConfig = {
    type: 'audio',
    codec: 'default' | 'opus'
} | {
    type: 'video',
    source: 'default' | 'screen',
    codec: 'default' | 'h264',
};

export interface CallScheduler {
    onConferenceStarted(ctx: Context, cid: number): Promise<void>;
    onConferenceStopped(ctx: Context, cid: number): Promise<void>;

    onPeerRemoved(ctx: Context, cid: number, pid: number): Promise<void>;
    onPeerStreamsChanged(ctx: Context, cid: number, pid: number, sources: MediaSources): Promise<void>;
    onPeerAdded(ctx: Context, cid: number, pid: number, sources: MediaSources): Promise<void>;

    onStreamCandidate(ctx: Context, cid: number, pid: number, sid: string, candidate: string): Promise<void>;
    onStreamOffer(ctx: Context, cid: number, pid: number, sid: string, offer: string): Promise<void>;
    onStreamAnswer(ctx: Context, cid: number, pid: number, sid: string, answer: string): Promise<void>;
}