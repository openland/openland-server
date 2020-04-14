import { Context } from '@openland/context';

export interface CallScheduler {
    getIceTransportPolicy(): Promise<'all' | 'relay'>;

    onConferenceStarted(ctx: Context, cid: number): Promise<void>;

    onConferenceStopped(ctx: Context, cid: number): Promise<void>;
}