import { Context } from '@openland/context';

export type StreamDefinition = {
    kind: 'video';
    source: 'default' | 'screen';
} | {
    kind: 'audio'
};

export interface CallScheduler {
    getIceTransportPolicy(): Promise<'all' | 'relay'>;

    onConferenceStarted(ctx: Context, cid: number): Promise<void>;
    onConferenceStopped(ctx: Context, cid: number): Promise<void>;

    onPeerRemoved(ctx: Context, pid: number): Promise<void>;
    onPeerStreamsChanged(ctx: Context, pid: number, streams: StreamDefinition[]): Promise<void>;
    onPeerAdded(ctx: Context, pid: number, streams: StreamDefinition[]): Promise<void>;
}