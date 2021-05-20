import { inTx } from '@openland/foundationdb';
import { createLogger } from '@openland/log';
import { CallRepository } from './CallRepository';
import { Context } from '@openland/context';
import { CallScheduler, MediaSources, StreamHint, Capabilities } from './CallScheduler';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { SyncWorkerQueue } from 'openland-module-workers/SyncWorkerQueue';
import { Store } from 'openland-module-db/FDB';
import { ScalableMediator, ScalableProducerPeerTask } from 'openland-module-calls/scalable/ScalableMediator';

const logger = createLogger('mediakitchen-scalable');

@injectable()
export class CallSchedulerScalable implements CallScheduler {

    // Candidates are ignored
    supportsCandidates = false;

    // Scalable conference worker
    readonly producersWorker = new SyncWorkerQueue<number, ScalableProducerPeerTask>(Store.ConferenceScalableQueueQueue, { maxAttempts: 'infinite', type: 'external' });

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

            // Persist capabilities
            this.mediator.repo.setPeerCapabilities(ctx, cid, pid, capabilities);

            // Producers
            if (role === 'speaker') {
                if ((await this.mediator.repo.addPeer(ctx, cid, pid, true)).wasAdded) {
                    await this.producersWorker.pushWork(ctx, cid, { type: 'add', cid, pid });
                }
            }

            // Consumers
            // TODO: Implement
        });
    }

    onPeerRoleChanged = async (parent: Context, cid: number, pid: number, role: 'speaker' | 'listener') => {
        logger.log(parent, 'Peer role changed in ' + cid + ': ' + pid);
        await inTx(parent, async (ctx) => {

            // Producers
            if (role === 'speaker') {
                if ((await this.mediator.repo.addPeer(ctx, cid, pid, true)).wasAdded) {
                    await this.producersWorker.pushWork(ctx, cid, { type: 'add', cid, pid });
                }
            } else {
                if ((await this.mediator.repo.removePeer(ctx, cid, pid, true)).wasRemoved) {
                    await this.producersWorker.pushWork(ctx, cid, { type: 'remove', cid, pid });
                }
            }

            // Consumers
            // TODO: Implement
        });
    }

    onPeerRemoved = async (parent: Context, cid: number, pid: number) => {
        logger.log(parent, 'Peer removed in ' + cid + ': ' + pid);
        await inTx(parent, async (ctx) => {

            // Producers
            if ((await this.mediator.repo.removePeer(ctx, cid, pid, true)).wasRemoved) {
                await this.producersWorker.pushWork(ctx, cid, { type: 'remove', cid, pid });
            }

            // Consumers
            // TODO: Implement
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
            await this.producersWorker.pushWork(ctx, cid, { type: 'offer', cid, pid, sid, sdp: JSON.parse(offer).sdp });
        });
    }

    onStreamAnswer = async (parent: Context, cid: number, pid: number, sid: string, answer: string) => {
        logger.log(parent, 'Peer stream answer in ' + cid + ': ' + pid);
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