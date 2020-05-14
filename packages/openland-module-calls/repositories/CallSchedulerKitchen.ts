import { CallSchedulerKitchenTransport } from './CallSchedulerKitchenTransport';
import { createLogger } from '@openland/log';
import { CallRepository } from './CallRepository';
import { Store } from 'openland-module-db/FDB';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { Context } from '@openland/context';
import { CallScheduler, MediaSources, StreamHint } from './CallScheduler';
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
        let routerId = await this.repo.createRouter(ctx);
        logger.log(ctx, 'Router created: ' + cid + '->' + routerId);
        // Delete kitchen router if exists (due to bug)
        let existing = await Store.ConferenceKitchenRouter.conference.find(ctx, cid);
        if (existing) {
            existing.deleted = true;
            await existing.flush(ctx);
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

    onPeerAdded = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {

        let router = await Store.ConferenceKitchenRouter.conference.find(ctx, cid);
        if (!router || router.deleted) {
            throw Error('Unknown error');
        }
        let existing = await Store.ConferenceKitchenPeer.conference.findAll(ctx, cid);
        let producerTransport = existing.length === 0 ? await this.transport.createProducerTransport(ctx, router.id, cid, pid, sources) : null;
        let consumerTransport = existing.length > 0 ? await this.transport.createConsumerTransport(ctx, router.id, cid, pid, existing.map((v) => v.producerTransport!)) : null;
        await Store.ConferenceKitchenPeer.create(ctx, pid, {
            cid,
            producerTransport,
            consumerTransport,
            active: true
        });

        // // Update existing connections
        // for (let e of existing) {
        //     if (!e.active) { // Just in case
        //         continue;
        //     }
        //     // Add new connection
        //     e.consumes = [...e.consumes, connection];
        //     await this.connections.updateConsumes(ctx, e.connection, e.consumes);
        // }
    }

    onPeerStreamsChanged = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
        if (!peer || !peer.active) {
            return;
        }
        if (peer.producerTransport) {
            await this.transport.updateProducerTransport(ctx, peer.producerTransport, sources);
        }
    }

    onPeerRemoved = async (ctx: Context, cid: number, pid: number) => {
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

    //
    // Events
    //

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