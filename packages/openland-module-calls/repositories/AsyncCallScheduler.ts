import { CallRepository } from './CallRepository';
import { Context } from '@openland/context';
import { CallScheduler, Capabilities, MediaSources, StreamHint } from './CallScheduler';

export type AsyncPeerTask =
    | { type: 'add', cid: number, pid: number, sources: MediaSources, capabilities: Capabilities, role: 'speaker' | 'listener' }
    | { type: 'remove', cid: number, pid: number }
    | { type: 'changed-streams', cid: number, pid: number, sources: MediaSources }
    | { type: 'changed-role', cid: number, pid: number, role: 'speaker' | 'listener' }
    | { type: 'candidate', cid: number, pid: number, sid: string, candidate: string }
    | { type: 'offer', cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null }
    | { type: 'answer', cid: number, pid: number, sid: string, answer: string }
    | { type: 'failed', cid: number, pid: number, sid: string };

export class AsyncCallScheduler implements CallScheduler {

    readonly inner: CallScheduler;
    readonly repo: CallRepository;

    constructor(inner: CallScheduler, repo: CallRepository) {
        this.inner = inner;
        this.repo = repo;
    }

    async onPeerAdded(ctx: Context, cid: number, pid: number, sources: MediaSources, capabilities: Capabilities, role: 'speaker' | 'listener'): Promise<void> {
        await this.repo.peerSyncQueue.pushWork(ctx, pid, { type: 'add', cid, pid, sources, capabilities, role });
    }

    async onPeerRemoved(ctx: Context, cid: number, pid: number): Promise<void> {
        await this.repo.peerSyncQueue.pushWork(ctx, pid, { type: 'remove', cid, pid });
    }

    async onPeerStreamsChanged(ctx: Context, cid: number, pid: number, sources: MediaSources): Promise<void> {
        await this.repo.peerSyncQueue.pushWork(ctx, pid, { type: 'changed-streams', cid, pid, sources });
    }

    async onPeerRoleChanged(ctx: Context, cid: number, pid: number, role: 'speaker' | 'listener'): Promise<void> {
        await this.repo.peerSyncQueue.pushWork(ctx, pid, { type: 'changed-role', cid, pid, role });
    }

    async onStreamCandidate(ctx: Context, cid: number, pid: number, sid: string, candidate: string): Promise<void> {
        await this.repo.peerSyncQueue.pushWork(ctx, pid, { type: 'candidate', cid, pid, sid, candidate });
    }

    async onStreamOffer(ctx: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null): Promise<void> {
        await this.repo.peerSyncQueue.pushWork(ctx, pid, { type: 'offer', cid, pid, sid, offer, hints });
    }

    async onStreamAnswer(ctx: Context, cid: number, pid: number, sid: string, answer: string): Promise<void> {
        await this.repo.peerSyncQueue.pushWork(ctx, pid, { type: 'answer', cid, pid, sid, answer });
    }

    async onStreamFailed(ctx: Context, cid: number, pid: number, sid: string): Promise<void> {
        await this.repo.peerSyncQueue.pushWork(ctx, pid, { type: 'failed', cid, pid, sid });
    }
}