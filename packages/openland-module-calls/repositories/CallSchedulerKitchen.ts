import { Store } from 'openland-module-db/FDB';
import { MediaKitchenRepository } from './MediaKitchenRepository';
import { Context } from '@openland/context';
import { CallScheduler, MediaSources } from './CallScheduler';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import sdpTransform from 'sdp-transform';

function convertIceCandidate(src: {
    foundation: string;
    protocol: string;
    priority: number | string;
    ip: string;
    port: number;
}) {
    let res: {
        foundation: string;
        component: number;
        transport: string;
        priority: number | string;
        ip: string;
        port: number;
        type: string;
        tcpType?: string;
    } = {
        component: 1, // Always 1
        foundation: src.foundation,
        ip: src.ip,
        port: src.port,
        priority: src.priority,
        transport: src.protocol,
        type: 'host'
    };

    if (src.protocol === 'tcp') {
        res.tcpType = 'passive';
    }

    return res;
}

@injectable()
export class CallSchedulerKitchen implements CallScheduler {

    @lazyInject('MediaKitchenRepository')
    readonly repo!: MediaKitchenRepository;

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
        let router = await Store.ConferenceKitchenRouter.conference.find(ctx, cid);
        if (!router || router.deleted) {
            return;
        }

        // Producer transport
        let producersTransport = await this.repo.createTransport(ctx, router.id);
        await Store.ConferenceEndStream.create(ctx, producersTransport, {
            pid,
            seq: 1,
            state: 'wait-offer',
            localCandidates: [],
            remoteCandidates: [],
            localSdp: null,
            remoteSdp: null,
            localStreams: [],
            remoteStreams: [],
            iceTransportPolicy: 'all'
        });
        await Store.ConferenceKitchenTransportState.create(ctx, producersTransport, {
            pid,
            state: 'perpare',
            producers: [],
            consumers: []
        });

        // Consumer transport
        let consumersTransport = await this.repo.createTransport(ctx, router.id);
        await Store.ConferenceEndStream.create(ctx, consumersTransport, {
            pid,
            seq: 1,
            state: 'wait-offer',
            localCandidates: [],
            remoteCandidates: [],
            localSdp: null,
            remoteSdp: null,
            localStreams: [],
            remoteStreams: [],
            iceTransportPolicy: 'all'
        });
        await Store.ConferenceKitchenTransportState.create(ctx, consumersTransport, {
            pid,
            state: 'perpare',
            producers: [],
            consumers: []
        });

        // Create Peer
        await Store.ConferenceKitchenPeer.create(ctx, cid, pid, {
            sources: sources,
            producersTransport,
            consumersTransport,
            active: true
        });
    }

    onPeerStreamsChanged = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {
        // TODO: Handle renegotiation
    }

    onPeerRemoved = async (ctx: Context, cid: number, pid: number) => {
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, cid, pid);
        if (!peer || !peer.active) {
            return;
        }
        peer.active = false;
        await peer.flush(ctx);

        // Remove transports
        await this.repo.deleteTransport(ctx, peer.consumersTransport);
        await this.repo.deleteTransport(ctx, peer.producersTransport);
    }

    //
    // Stream Events
    //

    onTransportCreated = async (ctx: Context, transportId: string) => {
        let state = await Store.ConferenceKitchenTransportState.findById(ctx, transportId);
        let endStream = await Store.ConferenceEndStream.findById(ctx, transportId);
        let transport = await Store.KitchenTransport.findById(ctx, transportId);
        if (!state || !endStream || !transport) {
            return;
        }

        if (state.state === 'perpare' && state.producers.length === 0 && state.consumers.length === 0) {
            state.state = 'ready';

            // Create SDP
            endStream.state = 'need-answer';
            endStream.seq++;

            let sdp: sdpTransform.SessionDescription = {
                // Boilerplate
                version: 0,
                origin: {
                    username: '-',
                    sessionId: '10000',
                    sessionVersion: endStream.seq,
                    netType: 'IN',
                    ipVer: 4,
                    address: '0.0.0.0'
                } as any,
                name: '-',
                timing: { start: 0, stop: 0 },

                // ICE
                groups: [{ type: 'BUNDLE', mids: '' }],
                fingerprint: {
                    type: transport.serverParameters!.fingerprints[transport.serverParameters!.fingerprints.length - 1].algorithm,
                    hash: transport.serverParameters!.fingerprints[transport.serverParameters!.fingerprints.length - 1].value
                },
                icelite: 'ice-lite',
                iceUfrag: transport.serverParameters!.iceParameters.usernameFragment,
                icePwd: transport.serverParameters!.iceParameters.password,
                msidSemantic: { semantic: 'WMS', token: '*' },
                ...{
                    candidates: transport.serverParameters!.iceCandidates.map((v) => convertIceCandidate(v)),
                    endOfCandidates: 'end-of-candidates',
                    iceOptions: 'renomination'
                },

                // Media
                media: []
            };
            endStream.remoteSdp = JSON.stringify({ type: 'offer', sdp: sdpTransform.write(sdp) });
        }
    }

    onStreamAnswer = async (ctx: Context, cid: number, pid: number, sid: string, answer: string) => {
        // TODO: Start Transport
    }

    //
    // Ignored
    //

    onStreamCandidate = async (ctx: Context, cid: number, pid: number, sid: string, candidate: string) => {
        // Ignore
    }
    onStreamOffer = async (ctx: Context, cid: number, pid: number, sid: string, offer: string) => {
        // Ignore
    }
}