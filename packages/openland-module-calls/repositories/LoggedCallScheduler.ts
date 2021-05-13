import { createLogger } from '@openland/log';
import { Context } from '@openland/context';
import { CallScheduler, Capabilities, MediaSources, StreamHint } from './CallScheduler';

const logger = createLogger('calls:logger');

export class LoggedCallScheduler implements CallScheduler {
    readonly inner: CallScheduler;

    get supportsCandidates() {
        return this.inner.supportsCandidates;
    }

    constructor(inner: CallScheduler) {
        this.inner = inner;
    }

    onPeerAdded(ctx: Context, cid: number, pid: number, sources: MediaSources, capabilities: Capabilities, role: 'speaker' | 'listener'): Promise<void> {
        logger.log(ctx, 'onPeerAdded: ', { cid, pid, sources, capabilities, role });
        return this.inner.onPeerAdded(ctx, cid, pid, sources, capabilities, role);
    }

    onPeerRemoved(ctx: Context, cid: number, pid: number): Promise<void> {
        logger.log(ctx, 'onPeerRemoved: ', { cid, pid });
        return this.inner.onPeerRemoved(ctx, cid, pid);
    }

    onPeerStreamsChanged(ctx: Context, cid: number, pid: number, sources: MediaSources): Promise<void> {
        logger.log(ctx, 'onPeerStreamsChanged: ', { cid, pid, sources });
        return this.inner.onPeerStreamsChanged(ctx, cid, pid, sources);
    }

    onPeerRoleChanged(ctx: Context, cid: number, pid: number, role: 'speaker' | 'listener'): Promise<void> {
        logger.log(ctx, 'onPeerRoleChanged: ', { cid, pid, role });
        return this.inner.onPeerRoleChanged(ctx, cid, pid, role);
    }

    onStreamCandidate(ctx: Context, cid: number, pid: number, sid: string, candidate: string): Promise<void> {
        logger.log(ctx, 'onStreamCandidate: ', { cid, pid, sid, candidate });
        return this.inner.onStreamCandidate(ctx, cid, pid, sid, candidate);
    }

    onStreamOffer(ctx: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null): Promise<void> {
        logger.log(ctx, 'onStreamOffer: ', { cid, pid, sid, offer, hints });
        return this.inner.onStreamOffer(ctx, cid, pid, sid, offer, hints);
    }

    onStreamAnswer(ctx: Context, cid: number, pid: number, sid: string, answer: string): Promise<void> {
        logger.log(ctx, 'onStreamAnswer: ', { cid, pid, sid, answer });
        return this.inner.onStreamAnswer(ctx, cid, pid, sid, answer);
    }

    onStreamFailed(ctx: Context, cid: number, pid: number, sid: string): Promise<void> {
        logger.log(ctx, 'onStreamFailed: ', { cid, pid, sid });
        return this.inner.onStreamFailed(ctx, cid, pid, sid);
    }
}