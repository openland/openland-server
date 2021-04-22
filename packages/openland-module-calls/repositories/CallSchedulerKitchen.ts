import { CallSchedulerKitchenTransport } from './CallSchedulerKitchenTransport';
import { createLogger } from '@openland/log';
import { CallRepository } from './CallRepository';
import { Store } from 'openland-module-db/FDB';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { Context } from '@openland/context';
import { CallScheduler, MediaSources, StreamHint, Capabilities } from './CallScheduler';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';

const logger = createLogger('mediakitchen');

@injectable()
export class CallSchedulerKitchen implements CallScheduler {

    @lazyInject('CallRepository')
    readonly callRepo!: CallRepository;

    @lazyInject('MediaKitchenRepository')
    readonly repo!: MediaKitchenRepository;

    @lazyInject('CallSchedulerKitchenTransport')
    readonly transport!: CallSchedulerKitchenTransport;

    //
    // Conference Events
    //

    onConferenceStarted = async (ctx: Context, cid: number) => {
        logger.log(ctx, 'Conference Started: ' + cid);
        let routerId = await this.repo.createRouter(ctx, ctx.req.ip ? ctx.req.ip : undefined);
        logger.log(ctx, 'Router created: ' + cid + '->' + routerId);

        // Delete kitchen router if exists (due to bug)
        let existing = await Store.ConferenceKitchenRouter.conference.find(ctx, cid);
        if (existing) {
            existing.deleted = true;
            await existing.flush(ctx);
            await this.repo.deleteRouter(ctx, existing.id);
        }

        await Store.ConferenceKitchenRouter.create(ctx, routerId, { cid, deleted: false });
    }

    onConferenceStopped = async (ctx: Context, cid: number) => {
        logger.log(ctx, 'Conference Stopped: ' + cid);
        let router = await Store.ConferenceKitchenRouter.conference.find(ctx, cid);
        if (!router || router.deleted) {
            return;
        }
        router.deleted = true;
        logger.log(ctx, 'Router deleted: ' + cid + '->' + router.id);
        await this.repo.deleteRouter(ctx, router.id);
    }

    //
    // Peer Events
    //

    onPeerAdded = async (ctx: Context, cid: number, pid: number, sources: MediaSources, capabilities: Capabilities, role: 'speaker' | 'listener') => {

        logger.log(ctx, 'Add peer');
        let router = await Store.ConferenceKitchenRouter.conference.find(ctx, cid);
        if (!router || router.deleted) {
            throw Error('Unknown error');
        }
        let existing = (await Store.ConferenceKitchenPeer.conference.findAll(ctx, cid)).filter((v) => !!v.producerTransport);
        let producerTransport = await this.transport.createProducerTransport(ctx, router.id, cid, pid, sources, capabilities);
        let consumerTransport = await this.transport.createConsumerTransport(ctx, router.id, cid, pid, existing.map((v) => v.producerTransport!), capabilities);
        await Store.ConferenceKitchenPeer.create(ctx, pid, {
            cid,
            capabilities,
            producerTransport,
            consumerTransport,
            active: true
        });

        // Update existing connections
        if (producerTransport) {
            for (let e of existing) {
                if (!e.active) { // Just in case
                    continue;
                }
                // Add new connection
                if (e.consumerTransport) {
                    let ct = (await Store.ConferenceKitchenConsumerTransport.findById(ctx, e.consumerTransport))!;
                    await this.transport.updateConsumerTransport(ctx, e.consumerTransport, [...ct.consumes, producerTransport]);
                    this.callRepo.notifyPeerChanged(ctx, e.pid);
                }
            }
        }

        logger.log(ctx, 'Add peer: end');
    }

    onPeerStreamsChanged = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
        if (!peer || !peer.active) {
            return;
        }
        if (peer.producerTransport) {
            await this.transport.updateProducerTransport(ctx, peer.producerTransport, sources);
            this.callRepo.notifyPeerChanged(ctx, pid);
        }
    }

    onPeerRemoved = async (ctx: Context, cid: number, pid: number) => {
        logger.log(ctx, 'Remove peer');
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
        if (!peer || !peer.active) {
            return;
        }

        if (peer.producerTransport) {
            await this.transport.removeProducerTransport(ctx, peer.producerTransport);
        }
        if (peer.consumerTransport) {
            await this.transport.removeConsumerTransport(ctx, peer.consumerTransport);
        }
        peer.active = false;
        await peer.flush(ctx);
    }

    onPeerRoleChanged = async (ctx: Context, cid: number, pid: number, currentRole: 'speaker' | 'listener') => {
        // noop
    }

    //
    // Events
    //

    onStreamFailed = async (ctx: Context, cid: number, pid: number, sid: string) => {
        // TODO: Implement
    }

    onStreamOffer = async (ctx: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null) => {
        await this.transport.onWebRTCConnectionOffer(ctx, sid, offer, hints);
    }

    onStreamAnswer = async (ctx: Context, cid: number, pid: number, sid: string, answer: string) => {
        await this.transport.onWebRTCConnectionAnswer(ctx, sid, answer);
    }

    onStreamCandidate = async (ctx: Context, cid: number, pid: number, sid: string, candidate: string) => {
        // Ignore
    }

    onTransportCreated = async (ctx: Context, transportId: string) => {
        await this.transport.onKitchenTransportCreated(ctx, transportId);
    }

    onTransportConnected = async (ctx: Context, transportId: string) => {
        await this.transport.onKitchenTransportCreated(ctx, transportId);
    }

    onProducerCreated = async (ctx: Context, transportId: string, producerId: string) => {
        await this.transport.onKitchenProducerCreated(ctx, transportId, producerId);
    }

    onConsumerCreated = async (ctx: Context, transportId: string, consumerId: string) => {
        await this.transport.onKitchenConsumerCreated(ctx, transportId, consumerId);
    }
}