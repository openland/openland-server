import { createLogger } from '@openland/log';
import { CallSchedulerKitchenConnections } from './CallSchedulerKitchenConnections';
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

    @lazyInject('CallSchedulerKitchenConnections')
    readonly connections!: CallSchedulerKitchenConnections;

    //
    // Conference Events
    //

    onConferenceStarted = async (ctx: Context, cid: number) => {
        logger.log(ctx, 'Conference Started: ' + cid);
        let routerId = await this.repo.createRouter(ctx);
        logger.log(ctx, 'Router created: ' + cid + '->' + routerId);
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
        let existing = await Store.ConferenceKitchenPeer.conference.findAll(ctx, cid);
        let consumerConnections = existing.map((v) => v.connection);
        let connection = await this.connections.createConnection(ctx, cid, pid, sources, consumerConnections);
        await Store.ConferenceKitchenPeer.create(ctx, pid, {
            cid,
            produces: sources,
            consumes: consumerConnections,
            connection,
            active: true
        });

        // Update existing connections
        for (let e of existing) {
            if (!e.active) { // Just in case
                continue;
            }
            // Add new connection
            e.consumes = [...e.consumes, connection];
            await this.connections.updateConsumes(ctx, e.connection, e.consumes);
        }
    }

    onPeerStreamsChanged = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
        if (!peer || !peer.active) {
            return;
        }
        await this.connections.updateProduces(ctx, peer.connection, sources);
    }

    onPeerRemoved = async (ctx: Context, cid: number, pid: number) => {
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
        if (!peer || !peer.active) {
            return;
        }

        await this.connections.removeConnection(ctx, peer.connection);
        peer.active = false;
        await peer.flush(ctx);
    }

    //
    // Events
    //

    onStreamOffer = async (ctx: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null) => {
        await this.connections.onWebRTCConnectionOffer(ctx, sid, offer, hints);
    }

    onStreamAnswer = async (ctx: Context, cid: number, pid: number, sid: string, answer: string) => {
        // Ignore
    }

    onStreamCandidate = async (ctx: Context, cid: number, pid: number, sid: string, candidate: string) => {
        // Ignore
    }

    onTransportCreated = async (ctx: Context, transportId: string) => {
        await this.connections.onKitchenTransportCreated(ctx, transportId);
    }

    onProducerCreated = async (ctx: Context, producerId: string) => {
        await this.connections.onKitchenProducerCreated(ctx, producerId);
    }

    onConsumerCreated = async (ctx: Context, consumerId: string) => {
        await this.connections.onKitchenConsumerCreated(ctx, consumerId);
    }
}