import { createLogger } from '@openland/log';
import { Context } from '@openland/context';
import { CallScheduler } from './CallScheduler';

const logger = createLogger('calls-mesh');

export class CallSchedulerMesh implements CallScheduler {
    private iceTransportPolicy: 'all' | 'relay';

    constructor(iceTransportPolicy: 'all' | 'relay') {
        this.iceTransportPolicy = iceTransportPolicy;
    }

    getIceTransportPolicy = async (): Promise<'all' | 'relay'> => {
        return this.iceTransportPolicy;
    }

    onConferenceStarted = async (ctx: Context, cid: number) => {
        logger.log(ctx, 'Conference started: ' + cid);
    }
    onConferenceStopped = async (ctx: Context, cid: number) => {
        logger.log(ctx, 'Conference stopped: ' + cid);
    }

    onPeerAdded = async (ctx: Context, pid: number) => {
        logger.log(ctx, 'Peer added: ' + pid);
    }

    onPeerStreamsChanged = async (ctx: Context, pid: number, streams: { kind: 'video' | 'audio', source: 'default' | 'screen' }[]) => {
        logger.log(ctx, 'Peer streems changed: ' + pid);
    }

    onPeerRemoved = async (ctx: Context, pid: number) => {
        logger.log(ctx, 'Peer removed: ' + pid);
    }
}