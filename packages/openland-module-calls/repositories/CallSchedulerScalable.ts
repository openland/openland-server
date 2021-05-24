import { inTx } from '@openland/foundationdb';
import { createLogger } from '@openland/log';
import { CallRepository } from './CallRepository';
import { Context } from '@openland/context';
import { CallScheduler, MediaSources, StreamHint, Capabilities } from './CallScheduler';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { SyncWorkerQueue } from 'openland-module-workers/SyncWorkerQueue';
import { Store } from 'openland-module-db/FDB';
import { ScalableMediator, ScalableSessionTask, ScalableShardTask } from 'openland-module-calls/scalable/ScalableMediator';

const logger = createLogger('mediakitchen-scalable');

@injectable()
export class CallSchedulerScalable implements CallScheduler {

    // Candidates are ignored
    supportsCandidates = false;

    // Scalable conference worker
    readonly sessionWorker = new SyncWorkerQueue<number, ScalableSessionTask>(Store.ConferenceScalableSessionQueue, { maxAttempts: 'infinite', type: 'transactional' });
    readonly shardWorker = new SyncWorkerQueue<string, ScalableShardTask>(Store.ConferenceScalableShardsQueue, { maxAttempts: 'infinite', type: 'external' });

    // Scalable mediator
    readonly mediator = new ScalableMediator();

    @lazyInject('CallRepository')
    readonly callRepo!: CallRepository;

    //
    // Peer Events
    //

    onPeerAdded = async (parent: Context, cid: number, pid: number, sources: MediaSources, capabilities: Capabilities, role: 'speaker' | 'listener') => {
        logger.log(parent, 'Add peer to ' + cid + ': ' + pid);
        await inTx(parent, async (ctx) => {
            this.mediator.repo.setPeerCapabilities(ctx, cid, pid, capabilities);
            await this.sessionWorker.pushWork(ctx, cid, { type: 'add', cid, pid, role });
        });
    }

    onPeerRoleChanged = async (parent: Context, cid: number, pid: number, role: 'speaker' | 'listener') => {
        logger.log(parent, 'Peer role changed in ' + cid + ': ' + pid);
        await inTx(parent, async (ctx) => {
            await this.sessionWorker.pushWork(ctx, cid, { type: 'role-change', cid, pid, role });
        });
    }

    onPeerRemoved = async (parent: Context, cid: number, pid: number) => {
        logger.log(parent, 'Peer removed in ' + cid + ': ' + pid);
        await inTx(parent, async (ctx) => {
            await this.sessionWorker.pushWork(ctx, cid, { type: 'remove', cid, pid });
        });
    }

    //
    // Events
    //

    onStreamFailed = async (parent: Context, cid: number, pid: number, sid: string) => {
        logger.log(parent, 'Peer stream failed changed in ' + cid + ': ' + pid);
    }

    onStreamOffer = async (parent: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null) => {
        logger.log(parent, 'Peer stream offer in ' + cid + ': ' + pid);
        await inTx(parent, async (ctx) => {
            let shard = await this.mediator.repo.getStreamShard(ctx, sid);
            if (shard) {
                await this.shardWorker.pushWork(ctx, cid + '_' + shard.session + '_' + shard.shard, {
                    type: 'offer',
                    cid,
                    pid,
                    session: shard.session,
                    shard: shard.shard,
                    sid,
                    sdp: JSON.parse(offer).sdp
                });
            }
        });
    }

    onStreamAnswer = async (parent: Context, cid: number, pid: number, sid: string, answer: string) => {
        logger.log(parent, 'Peer stream answer in ' + cid + ': ' + pid);
        await inTx(parent, async (ctx) => {
            let shard = await this.mediator.repo.getStreamShard(ctx, sid);
            if (shard) {
                await this.shardWorker.pushWork(ctx, cid + '_' + shard.session + '_' + shard.shard, {
                    type: 'answer',
                    cid,
                    pid,
                    session: shard.session,
                    shard: shard.shard,
                    sid,
                    sdp: JSON.parse(answer).sdp
                });
            }
        });
    }

    //
    // Unsupported
    //

    onStreamCandidate = async (ctx: Context, cid: number, pid: number, sid: string, candidate: string) => {
        // Ignore
    }

    onPeerStreamsChanged = async (parent: Context, cid: number, pid: number, sources: MediaSources) => {
        // Ignore
    }
}