import { CallRepository } from './../repositories/CallRepository';

export function declarePeerWorker(repo: CallRepository) {
    repo.peerSyncQueue.addWorker(10, async (ctx, tasks) => {
        for (const t of tasks) {
            if (t.type === 'add') {
                await repo.asyncKitchen.inner.onPeerAdded(ctx, t.cid, t.pid, t.sources, t.capabilities, t.role);
            } else if (t.type === 'changed-streams') {
                await repo.asyncKitchen.inner.onPeerStreamsChanged(ctx, t.cid, t.pid, t.sources);
            } else if (t.type === 'changed-role') {
                await repo.asyncKitchen.inner.onPeerRoleChanged(ctx, t.cid, t.pid, t.role);
            } else if (t.type === 'remove') {
                await repo.asyncKitchen.inner.onPeerRemoved(ctx, t.cid, t.pid);
            } else if (t.type === 'offer') {
                await repo.asyncKitchen.inner.onStreamOffer(ctx, t.cid, t.pid, t.sid, t.offer, t.hints);
            } else if (t.type === 'answer') {
                await repo.asyncKitchen.inner.onStreamAnswer(ctx, t.cid, t.pid, t.sid, t.answer);
            } else if (t.type === 'candidate') {
                await repo.asyncKitchen.inner.onStreamCandidate(ctx, t.cid, t.pid, t.sid, t.candidate);
            } else if (t.type === 'failed') {
                await repo.asyncKitchen.inner.onStreamFailed(ctx, t.cid, t.pid, t.sid);
            }
        }
    });
}