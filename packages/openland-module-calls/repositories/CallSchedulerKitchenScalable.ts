import { createLogger } from '@openland/log';
import { CallRepository } from './CallRepository';
import { Context } from '@openland/context';
import { CallScheduler, MediaSources, StreamHint, Capabilities } from './CallScheduler';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';

const logger = createLogger('mediakitchen-scalable');

@injectable()
export class CallSchedulerKitchenScalable implements CallScheduler {

    // Candidates are ignored
    supportsCandidates = false;

    @lazyInject('CallRepository')
    readonly callRepo!: CallRepository;

    //
    // Peer Events
    //

    onPeerAdded = async (parent: Context, cid: number, pid: number, sources: MediaSources, capabilities: Capabilities, role: 'speaker' | 'listener') => {
        logger.log(parent, 'Add peer to ' + cid + ': ' + pid);
    }

    onPeerStreamsChanged = async (parent: Context, cid: number, pid: number, sources: MediaSources) => {
        logger.log(parent, 'Peer streams changed in ' + cid + ': ' + pid);
    }

    onPeerRemoved = async (parent: Context, cid: number, pid: number) => {
        logger.log(parent, 'Peer removed in ' + cid + ': ' + pid);
    }

    onPeerRoleChanged = async (parent: Context, cid: number, pid: number, role: 'speaker' | 'listener') => {
        logger.log(parent, 'Peer role changed in ' + cid + ': ' + pid);
    }

    //
    // Events
    //

    onStreamFailed = async (parent: Context, cid: number, pid: number, sid: string) => {
        logger.log(parent, 'Peer stream failed changed in ' + cid + ': ' + pid);
    }

    onStreamOffer = async (parent: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null) => {
        logger.log(parent, 'Peer stream offer in ' + cid + ': ' + pid);
    }

    onStreamAnswer = async (parent: Context, cid: number, pid: number, sid: string, answer: string) => {
        logger.log(parent, 'Peer stream answer in ' + cid + ': ' + pid);
    }

    onStreamCandidate = async (ctx: Context, cid: number, pid: number, sid: string, candidate: string) => {
        // Ignore
    }
}