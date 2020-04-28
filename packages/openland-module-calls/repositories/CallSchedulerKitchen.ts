import { CallSchedulerKitchenConnections } from './CallSchedulerKitchenConnections';
import { CallRepository } from './CallRepository';
import { Store } from 'openland-module-db/FDB';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { Context } from '@openland/context';
import { CallScheduler, MediaSources, StreamHint } from './CallScheduler';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';

function extractGenericSources(source: MediaSources): MediaSources {
    return {
        audioStream: source.audioStream,
        videoStream: source.videoStream,
        screenCastStream: false
    };
}

function extractCastSources(source: MediaSources): MediaSources {
    return {
        audioStream: false,
        videoStream: false,
        screenCastStream: source.screenCastStream
    };
}

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
        let routerId = await this.repo.createRouter(ctx);
        await Store.ConferenceKitchenRouter.create(ctx, routerId, { cid, deleted: false });
    }

    onConferenceStopped = async (ctx: Context, cid: number) => {
        let router = await Store.ConferenceKitchenRouter.conference.find(ctx, cid);
        if (!router || router.deleted) {
            return;
        }
        router.deleted = true;
        await this.repo.deleteRouter(ctx, router.id);
    }

    //
    // Peer Events
    //

    onPeerAdded = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {

        let genericTransport = await this.connections.createProducerConnection(ctx, cid, pid, extractGenericSources(sources));
        let screencastTransport = await this.connections.createProducerConnection(ctx, cid, pid, extractCastSources(sources));

        await Store.ConferenceKitchenPeer.create(ctx, pid, {
            cid,
            sources: sources,

            genericTransport: genericTransport,
            screencastTransport: screencastTransport,
            consumersTransport: null,

            active: true
        });
    }

    onPeerStreamsChanged = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
        if (!peer || !peer.active) {
            return;
        }
        if (peer.genericTransport) {
            await this.connections.updateProducerStreams(ctx, peer.genericTransport, extractGenericSources(sources));
        }
        if (peer.screencastTransport) {
            await this.connections.updateProducerStreams(ctx, peer.screencastTransport, extractCastSources(sources));
        }
    }

    onPeerRemoved = async (ctx: Context, cid: number, pid: number) => {
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
        if (!peer || !peer.active) {
            return;
        }

        if (peer.genericTransport) {
            await this.connections.removeConnection(ctx, peer.genericTransport);
        }
        if (peer.screencastTransport) {
            await this.connections.removeConnection(ctx, peer.screencastTransport);
        }

        peer.active = false;
        await peer.flush(ctx);
    }

    //
    // Events
    //

    onStreamAnswer = async (ctx: Context, cid: number, pid: number, sid: string, answer: string) => {
        await this.connections.onWebRTCConnectionAnswer(ctx, sid, answer);
    }

    onStreamOffer = async (ctx: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null) => {
        await this.connections.onWebRTCConnectionOffer(ctx, sid, offer, hints);
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