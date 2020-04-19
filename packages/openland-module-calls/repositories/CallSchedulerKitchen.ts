import { CallRepository } from './CallRepository';
import { SDP } from './../sdp/SDP';
import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { Context } from '@openland/context';
import { CallScheduler, MediaSources } from './CallScheduler';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { parseSDP } from '../sdp/parseSDP';
import { extractFingerprints } from '../sdp/extractFingerprints';
import { convertIceCandidate } from '../kitchen/convert';
import { writeSDP } from 'openland-module-calls/sdp/writeSDP';
// import sdpTransform from 'sdp-transform';

const logger = createLogger('calls');

function convertParameters(src: any) {
    return Object.keys(src).map((key) => `${key}=${src[key]}`).join(';');
}

@injectable()
export class CallSchedulerKitchen implements CallScheduler {

    @lazyInject('CallRepository')
    readonly callRepo!: CallRepository;

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

        //
        // Generic Media
        //

        let genericTransport: string | null = null;
        if (sources.audioStream || sources.videoStream) {
            // Create kitchen transport
            genericTransport = await this.repo.createTransport(ctx, router.id);

            // Convert streams
            let localStreams: ({ type: 'audio', codec: 'default' | 'opus' }
                | { type: 'video', codec: 'default' | 'h264', source: 'default' | 'screen' })[] = [];
            if (sources.audioStream) {
                localStreams.push({ type: 'audio', codec: 'opus' });
            }
            if (sources.videoStream) {
                localStreams.push({ type: 'video', codec: 'h264', source: 'default' });
            }

            // Create end stream
            await Store.ConferenceEndStream.create(ctx, genericTransport, {
                pid,
                seq: 1,
                state: 'need-offer',
                localCandidates: [],
                remoteCandidates: [],
                localSdp: null,
                remoteSdp: null,
                localStreams,
                remoteStreams: [],
                iceTransportPolicy: 'all'
            });
        }

        // Create Peer
        await Store.ConferenceKitchenPeer.create(ctx, pid, {
            cid,
            sources: sources,

            genericTransport: genericTransport,
            genericAudioProducer: null,
            genericVideoProducer: null,

            screencastTransport: null,
            screencastVideoProducer: null,

            consumersTransport: null,
            consumers: null,

            active: true
        });
    }

    onPeerStreamsChanged = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {
        // TODO: Handle renegotiation
    }

    onPeerRemoved = async (ctx: Context, cid: number, pid: number) => {
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
        if (!peer || !peer.active) {
            return;
        }
        peer.active = false;
        await peer.flush(ctx);

        // Remove transports
        if (peer.consumersTransport) {
            await this.repo.deleteTransport(ctx, peer.consumersTransport);
        }
        if (peer.genericTransport) {
            await this.repo.deleteTransport(ctx, peer.genericTransport);
        }
        if (peer.screencastTransport) {
            await this.repo.deleteTransport(ctx, peer.screencastTransport);
        }
    }

    //
    // WebRTC Events
    //

    onStreamAnswer = async (ctx: Context, cid: number, pid: number, sid: string, answer: string) => {
        // TODO: Start Transport
    }

    onStreamOffer = async (ctx: Context, cid: number, pid: number, sid: string, offer: string) => {
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
        let endStream = await Store.ConferenceEndStream.findById(ctx, sid);
        let transport = await Store.KitchenTransport.findById(ctx, sid);
        if (!endStream || !transport || !peer) {
            return;
        }
        logger.log(ctx, 'offer: ' + sid);

        // Only producing transport support offers
        if (sid !== peer.genericTransport && sid !== peer.screencastTransport) {
            return;
        }

        // Parsing
        let data = JSON.parse(offer);
        if (data.type !== 'offer') {
            throw Error('SDP is not offer!');
        }
        let sdp = parseSDP(data.sdp as string);
        logger.log(ctx, 'Offer: ' + JSON.stringify(sdp));

        // Transport Connect
        let fingerprints = extractFingerprints(sdp);
        await this.repo.connectTransport(ctx, transport.id, fingerprints);

        // Check streams
        let numberAudioStreams = sdp.media.filter((v) => v.type === 'audio').length;
        if (numberAudioStreams !== 1) {
            throw Error('Invalid number of audio streams');
        }

        // Resolve Audio parameters
        let audioMedia = sdp.media.find((v) => v.type === 'audio')!;
        const codec = audioMedia.rtp.find((v) => v.codec === 'opus');
        if (!codec) {
            throw Error('Unable to find audio codec!');
        }
        let params: any = {};
        let fmt = audioMedia.fmtp.find((v) => v.payload === codec.payload);
        if (fmt) {
            let parts = fmt.config.split(';');
            for (let p of parts) {
                let kv = p.split('=');
                if (kv[0] === 'minptime') {
                    params[kv[0]] = parseInt(kv[1], 10);
                } else if (kv[0] === 'useinbandfec') {
                    params[kv[0]] = parseInt(kv[1], 10);
                }
            }
        }
        let codecParameters = {
            mimeType: 'audio/opus',
            payloadType: codec.payload,
            clockRate: 48000,
            channels: 2,
            parameters: params,
            rtcpFeedback: [{
                type: 'transport-cc'
            }]
        };
        let ssrc = audioMedia.ssrcs![0].id as number;

        // Create Producer
        let producer = await this.repo.createProducer(ctx, sid, {
            kind: 'audio',
            rtpParameters: {
                codecs: [codecParameters],
                encodings: [{ ssrc: ssrc }]
            }
        });
        peer.genericAudioProducer = producer;
    }

    onStreamCandidate = async (ctx: Context, cid: number, pid: number, sid: string, candidate: string) => {
        // Ignore
    }

    //
    // Kitchen Events
    //

    onTransportCreated = async (ctx: Context, transportId: string) => {
        await this.#checkAnswer(ctx, transportId);
    }

    onProducerCreated = async (ctx: Context, producerId: string) => {
        let producer = await Store.KitchenProducer.findById(ctx, producerId);
        if (producer) {
            await this.#checkAnswer(ctx, producer.transportId);
        }
    }

    onConsumerCreated = async (ctx: Context, consumerId: string) => {
        let producer = await Store.KitchenConsumer.findById(ctx, consumerId);
        if (producer) {
            await this.#checkAnswer(ctx, producer.transportId);
        }
    }

    //
    // Implementation
    //

    #checkAnswer = async (ctx: Context, transportId: string) => {

        logger.log(ctx, 'checkanswer: ' + transportId);

        // Check transport state
        let transport = await Store.KitchenTransport.findById(ctx, transportId);
        if (!transport || transport.state === 'creating' || transport.state === 'deleted' || transport.state === 'deleting') {
            logger.log(ctx, 'checkanswer: ' + transportId + ': tx not ready');
            return;
        }

        // Check end stream state
        let endStream = await Store.ConferenceEndStream.findById(ctx, transportId);
        if (!endStream || endStream.state !== 'wait-answer') {
            logger.log(ctx, 'checkanswer: ' + transportId + ': not wait-answer');
            return;
        }

        // Check peer
        let peer = await Store.ConferenceKitchenPeer.findById(ctx, endStream.pid);
        if (!peer || !peer.active) {
            logger.log(ctx, 'checkanswer: ' + transportId + ': peer invalid');
            return;
        }

        // Generic transport
        if (peer.genericTransport === transportId) {

            // Check audio producer
            if (!peer.genericAudioProducer) {
                logger.log(ctx, 'checkanswer: ' + transportId + ': no audio producer');
                return;
            }

            // Check producer state
            let producer = await Store.KitchenProducer.findById(ctx, peer.genericAudioProducer);
            if (!producer || producer.state !== 'created') {
                logger.log(ctx, 'checkanswer: ' + transportId + ': producer not created');
                return;
            }

            endStream.seq++;
            endStream.state = 'online';

            let fingerprints = transport.serverParameters!.fingerprints;
            let iceParameters = transport.serverParameters!.iceParameters;
            let iceCandidates = transport.serverParameters!.iceCandidates;
            let answer: SDP = {

                // Boilerplate
                version: 0,
                origin: {
                    username: '-',
                    sessionId: '10000',
                    sessionVersion: 1,
                    netType: 'IN',
                    ipVer: 4,
                    address: '0.0.0.0'
                } as any,
                name: '-',
                timing: { start: 0, stop: 0 },

                // ICE
                groups: [{ type: 'BUNDLE', mids: '0' }],
                fingerprint: {
                    type: fingerprints[fingerprints.length - 1].algorithm,
                    hash: fingerprints[fingerprints.length - 1].value
                },
                icelite: 'ice-lite',
                iceUfrag: iceParameters.usernameFragment,
                icePwd: iceParameters.password,
                msidSemantic: { semantic: 'WMS', token: '*' },

                // Media
                media: [{
                    mid: '0',
                    type: 'audio',
                    protocol: 'UDP/TLS/RTP/SAVPF',
                    payloads: producer.rtpParameters!.codecs[0].payloadType.toString(),
                    port: 7,
                    rtcpMux: 'rtcp-mux',
                    rtcpRsize: 'rtcp-rsize',
                    direction: 'recvonly',

                    // Codec
                    rtp: [{
                        payload: producer.rtpParameters!.codecs[0].payloadType,
                        rate: producer.rtpParameters!.codecs[0].clockRate,
                        encoding: 2,
                        codec: 'opus',
                    }],
                    fmtp: [{
                        payload: producer.rtpParameters!.codecs[0].payloadType,
                        config: convertParameters(producer.rtpParameters!.codecs[0].parameters || {})
                    }],
                    rtcpFb: producer.rtpParameters!.codecs[0].rtcpFeedback!.map((v) => ({
                        payload: producer!.rtpParameters!.codecs[0].payloadType,
                        type: v.type,
                        subtype: v.parameter ? v.parameter : undefined
                    })),

                    // ICE + DTLS
                    setup: 'active',
                    connection: { ip: '127.0.0.1', version: 4 },
                    candidates: iceCandidates.map((v) => convertIceCandidate(v)),
                    endOfCandidates: 'end-of-candidates',
                    ...{ iceOptions: 'renomination' },
                }]
            };

            endStream.remoteSdp = JSON.stringify({ type: 'answer', sdp: writeSDP(answer) });

            await this.callRepo.bumpVersion(ctx, peer.cid);
        }
    }
}