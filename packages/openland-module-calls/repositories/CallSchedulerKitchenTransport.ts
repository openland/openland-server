import { ICE_TRANSPORT_POLICY } from './../kitchen/MediaKitchenProfiles';
import { KitchenRtpCapabilities } from './../kitchen/types';
import { createLogger } from '@openland/log';
import { KitchenRtpParameters, KitchenIceCandidate } from '../kitchen/types';
import { writeSDP } from 'openland-module-calls/sdp/writeSDP';
import { SDP } from '../sdp/SDP';
import { KitchenProducer } from '../../openland-module-db/store';
import { parseSDP } from 'openland-module-calls/sdp/parseSDP';
import { Store } from 'openland-module-db/FDB';
import { MediaSources, StreamHint, ProducerDescriptor, Capabilities } from './CallScheduler';
import { Context } from '@openland/context';
import { CallRepository, DEFAULT_CAPABILITIES } from './CallRepository';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import uuid from 'uuid/v4';
import { extractFingerprints } from 'openland-module-calls/sdp/extractFingerprints';
import { extractOpusRtpParameters, extractH264RtpParameters, convertParameters, convertIceCandidate, extractVP8RtpParameters } from 'openland-module-calls/kitchen/extract';
import { MediaDescription } from 'sdp-transform';

const logger = createLogger('mediakitchen');

function getAudioRtpCapabilities(src: Capabilities): KitchenRtpCapabilities {
    let codec = src.codecs.find((v) => v.mimeType === 'audio/opus');
    if (!codec) {
        throw Error('Unable to find OPUS codec');
    }

    let res: KitchenRtpCapabilities = {
        codecs: [{
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            parameters: {
                stereo: 1,
                maxplaybackrate: 48000,
                useinbandfec: 1
            },
            rtcpFeedback: codec.rtcpFeedback.map((f) => ({ type: f.type, parameter: f.value }))
        }],
        headerExtensions: src.headerExtensions
            .filter((v) => v.kind === 'audio')
            .map((h) => ({
                uri: h.uri,
                preferredId: h.preferredId,
                kind: 'audio'
            }))
    };

    return res;
}

function getVideoCapabilities(src: Capabilities): KitchenRtpCapabilities {

    let codecs: KitchenRtpCapabilities['codecs'] = [];

    let h264codec = src.codecs.find((v) =>
        v.mimeType === 'video/H264'
        && v.parameters.some((p) => p.key === 'profile-level-id' && (p.value === '42e034' || p.value === '42e01f'))
        && v.parameters.some((p) => p.key === 'packetization-mode' && p.value === '1')
    );
    if (h264codec) {
        codecs.push({
            kind: 'audio',
            mimeType: 'video/H264',
            clockRate: 90000,
            parameters: {
                'packetization-mode': 1,
                'profile-level-id': '42e01f',
                'level-asymmetry-allowed': 1,
            },
            rtcpFeedback: h264codec.rtcpFeedback.map((f) => ({ type: f.type, parameter: f.value }))
        });
    }

    let vp8codec = src.codecs.find((v) =>
        v.mimeType === 'video/VP8'
    );
    if (vp8codec) {
        codecs.push({
            kind: 'audio',
            mimeType: 'video/VP8',
            clockRate: 90000,
            parameters: {},
            rtcpFeedback: vp8codec.rtcpFeedback.map((f) => ({ type: f.type, parameter: f.value }))
        });
    }

    let res: KitchenRtpCapabilities = {
        codecs,
        headerExtensions: src.headerExtensions
            .filter((v) => v.kind === 'video')
            .map((h) => ({
                uri: h.uri,
                preferredId: h.preferredId,
                kind: 'video'
            }))
    };
    return res;
}

function generateSDP(
    fingerprints: { algorithm: string, value: string }[],
    iceParameters: { usernameFragment: string, password: string },
    media: Array<{
        type: string;
        port: number;
        protocol: string;
        payloads?: string;
    } & MediaDescription>
) {
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
        fingerprint: {
            type: fingerprints[fingerprints.length - 1].algorithm,
            hash: fingerprints[fingerprints.length - 1].value
        },
        icelite: 'ice-lite',
        iceUfrag: iceParameters.usernameFragment,
        icePwd: iceParameters.password,

        // Media
        msidSemantic: { semantic: 'WMS', token: '*' },
        groups: media.length > 0 ? [{ type: 'BUNDLE', mids: media.map((v) => v.mid!).join(' ') }] : undefined,
        media: media
    };
    return writeSDP(answer);
}

function createMediaDescription(
    mid: string,
    type: 'video' | 'audio',
    port: number,
    direction: 'recvonly' | 'sendonly',
    active: boolean,
    rtpParameters: KitchenRtpParameters,
    iceCandidates: KitchenIceCandidate[],
): {
    type: string;
    port: number;
    protocol: string;
    payloads?: string;
} & MediaDescription {
    let rtcpFb: MediaDescription['rtcpFb'] = [];
    for (let c of rtpParameters.codecs) {
        if (c.rtcpFeedback) {
            for (let v of c.rtcpFeedback) {
                rtcpFb.push({
                    payload: c.payloadType,
                    type: v.type,
                    subtype: v.parameter ? v.parameter : undefined
                });
            }
        }
    }
    return {
        mid,
        type,
        protocol: 'UDP/TLS/RTP/SAVPF',
        payloads: rtpParameters.codecs.map((v) => v.payloadType.toString()).join(' '),
        port,
        rtcpMux: 'rtcp-mux',
        rtcpRsize: 'rtcp-rsize',
        direction: active ? direction : 'inactive',
        ext: (rtpParameters.headerExtensions || []).map((v) => ({
            value: v.id,
            uri: v.uri
        })),

        // Codec
        rtp: rtpParameters.codecs.map((v) => ({
            codec: v.mimeType.substring(6),
            payload: v.payloadType,
            rate: v.clockRate,
            encoding: v.channels ? v.channels : undefined,
        })),
        fmtp: rtpParameters.codecs.filter((v) => !!v.parameters && Object.keys(v.parameters).length > 0).map((v) => ({
            payload: v.payloadType,
            config: convertParameters(v.parameters!)
        })),
        rtcpFb,

        // ICE + DTLS
        setup: direction === 'sendonly' ? 'actpass' : 'active',
        connection: { ip: '0.0.0.0', version: 4 },
        candidates: iceCandidates.map((v) => convertIceCandidate(v)),
        endOfCandidates: 'end-of-candidates',
        ...{ iceOptions: 'renomination' },

        // SSRC
        ssrcs: [{ id: rtpParameters.encodings![0].ssrc!, attribute: 'cname', value: rtpParameters.rtcp!.cname! }]
    };
}

@injectable()
export class CallSchedulerKitchenTransport {

    @lazyInject('MediaKitchenRepository')
    readonly repo!: MediaKitchenRepository;

    @lazyInject('CallRepository')
    readonly callRepo!: CallRepository;

    //
    // Create
    //

    createProducerTransport = async (ctx: Context, router: string, cid: number, pid: number, produces: MediaSources, capabilities: Capabilities) => {
        // transport id
        let id = uuid();

        logger.log(ctx, 'ProducerTransport Create: ' + pid + ' ' + JSON.stringify(produces));

        // Raw transport
        await this.repo.createTransport(ctx, id, router);

        // End Stream
        let localStreams: ProducerDescriptor[] = [];
        if (produces.videoStream) {
            localStreams.push({ type: 'video', codec: 'h264', source: 'default', mid: null });
        }
        if (produces.screenCastStream) {
            localStreams.push({ type: 'video', codec: 'h264', source: 'screen', mid: null });
        }
        if (produces.audioStream) {
            localStreams.push({ type: 'audio', codec: 'opus', mid: null });
        }
        await Store.ConferenceEndStream.create(ctx, id, {
            pid,
            seq: 1,
            state: 'need-offer',
            localCandidates: [],
            remoteCandidates: [],
            localSdp: null,
            remoteSdp: null,
            localStreams: localStreams,
            remoteStreams: [],
            iceTransportPolicy: ICE_TRANSPORT_POLICY
        });

        // Producer transport
        await Store.ConferenceKitchenProducerTransport.create(ctx, id, {
            pid,
            cid,
            produces,
            capabilities,
            state: 'negotiation-need-offer',
            audioProducer: null,
            audioProducerMid: null,
            videoProducer: null,
            videoProducerMid: null,
            screencastProducer: null,
            screencastProducerMid: null,
        });

        // Bump
        await this.callRepo.bumpVersion(ctx, cid, pid);

        return id;
    }

    createConsumerTransport = async (ctx: Context, router: string, cid: number, pid: number, consumes: string[], capabilities: Capabilities) => {
        // transport id
        let id = uuid();

        logger.log(ctx, 'ConsumerTransport Create: ' + pid + ' ' + consumes);

        // Raw transport
        await this.repo.createTransport(ctx, id, router);

        // Resolve active producers
        let consumers: {
            pid: number,
            consumer: string,
            transport: string,
            active: boolean,
            media: { type: 'audio', } | { type: 'video', source: 'default' | 'screen' }
        }[] = [];
        for (let transport of consumes) {
            let producerTransport = (await Store.ConferenceKitchenProducerTransport.findById(ctx, transport))!;
            if (producerTransport.state === 'closed') {
                continue;
            }
            if (producerTransport.audioProducer) {
                if (producerTransport.produces.audioStream) {
                    let consumer = await this.repo.createConsumer(ctx, id, producerTransport.audioProducer, { rtpCapabilities: getAudioRtpCapabilities(capabilities), paused: true });
                    consumers.push({
                        pid: producerTransport.pid,
                        consumer,
                        transport,
                        active: producerTransport.produces.audioStream,
                        media: { type: 'audio' }
                    });
                }
            }

            if (producerTransport.videoProducer) {
                if (producerTransport.produces.videoStream) {
                    let consumer = await this.repo.createConsumer(ctx, id, producerTransport.videoProducer, { rtpCapabilities: getVideoCapabilities(capabilities), paused: true });
                    consumers.push({
                        pid: producerTransport.pid,
                        consumer,
                        transport,
                        active: true,
                        media: { type: 'video', source: 'default' }
                    });
                }
            }

            if (producerTransport.screencastProducer) {
                if (producerTransport.produces.screenCastStream) {
                    let consumer = await this.repo.createConsumer(ctx, id, producerTransport.screencastProducer, { rtpCapabilities: getVideoCapabilities(capabilities), paused: true });
                    consumers.push({
                        pid: producerTransport.pid,
                        consumer,
                        transport,
                        active: false,
                        media: { type: 'video', source: 'screen' }
                    });
                }
            }
        }

        // Consumer transport
        await Store.ConferenceKitchenConsumerTransport.create(ctx, id, {
            pid,
            cid,
            capabilities,
            consumes,
            consumers,
            state: 'negotiation-wait-offer',
        });

        // End stream
        await Store.ConferenceEndStream.create(ctx, id, {
            pid,
            seq: 1,
            state: 'wait-offer',
            localCandidates: [],
            remoteCandidates: [],
            localSdp: null,
            remoteSdp: null,
            localStreams: [],
            remoteStreams: [],
            iceTransportPolicy: ICE_TRANSPORT_POLICY
        });

        // Create offer if needed
        await this.#createConsumerOfferIfNeeded(ctx, id);

        return id;
    }

    updateProducerTransport = async (ctx: Context, id: string, produces: MediaSources) => {
        let producer = await Store.ConferenceKitchenProducerTransport.findById(ctx, id);
        if (!producer || producer.state === 'closed') {
            return;
        }

        // If not changed
        if (producer.produces.audioStream === produces.audioStream
            && producer.produces.videoStream === produces.videoStream
            && producer.produces.screenCastStream === produces.screenCastStream) {
            return;
        }

        logger.log(ctx, 'ProducerTransport Update: ' + producer.pid + ' ' + JSON.stringify(produces));

        // Switch to need offer state
        producer.state = 'negotiation-need-offer';
        producer.produces = { ...produces };

        // Update Conference End Stream
        let stream = (await Store.ConferenceEndStream.findById(ctx, id))!;
        let localStreams: ProducerDescriptor[] = [];
        if (produces.videoStream) {
            localStreams.push({ type: 'video', codec: 'h264', source: 'default', mid: null });
        }
        if (produces.screenCastStream) {
            localStreams.push({ type: 'video', codec: 'h264', source: 'screen', mid: null });
        }
        if (produces.audioStream) {
            localStreams.push({ type: 'audio', codec: 'opus', mid: null });
        }
        stream.state = 'need-offer';
        stream.localStreams = localStreams;
        stream.seq++;

        // Update consumers
        let consumers = await Store.ConferenceKitchenConsumerTransport.fromConference.findAll(ctx, producer.cid);
        for (let c of consumers) {
            if (c.consumes.find((v) => v === id)) {
                await this.#refreshConsumerIfNeeded(ctx, c.id);
            }
        }
    }

    updateConsumerTransport = async (ctx: Context, transportId: string, consumes: string[]) => {
        // Update Consumer
        let consumerTransport = await Store.ConferenceKitchenConsumerTransport.findById(ctx, transportId);
        if (!consumerTransport || consumerTransport.state === 'closed') {
            throw Error('Unable to find connection');
        }
        consumerTransport.consumes = consumes;
        await consumerTransport.flush(ctx);

        await this.#refreshConsumerIfNeeded(ctx, transportId);
    }

    removeProducerTransport = async (ctx: Context, id: string) => {

        // Close Connection
        let producerTransport = await Store.ConferenceKitchenProducerTransport.findById(ctx, id);
        if (!producerTransport || producerTransport.state === 'closed') {
            throw Error('Unable to find connection');
        }
        producerTransport.state = 'closed';
        await producerTransport.flush(ctx);

        logger.log(ctx, 'ProducerTransport Remove: ' + producerTransport.pid);

        // Close End Stream
        let stream = (await Store.ConferenceEndStream.findById(ctx, id))!;
        stream.seq++;
        stream.state = 'completed';
        stream.remoteCandidates = [];
        stream.localCandidates = [];
        stream.localSdp = null;
        stream.remoteSdp = null;
        stream.localStreams = [];
        stream.remoteStreams = [];

        // Remove consumes
        let consumers = await Store.ConferenceKitchenConsumerTransport.fromConference.findAll(ctx, producerTransport.cid);
        for (let c of consumers) {
            if (c.consumes.find((v) => v === id)) {
                c.consumes = c.consumes.filter((v) => v !== id);
                await c.flush(ctx);
                await this.#refreshConsumerIfNeeded(ctx, c.id);
            }
        }

        // Delete transport
        // Not deleting producer transports until we figure out how to deal with eventual consistency
        // await this.repo.deleteTransport(ctx, id);

        // Bump
        await this.callRepo.bumpVersion(ctx, producerTransport.cid, producerTransport.pid);
    }

    removeConsumerTransport = async (ctx: Context, id: string) => {
        // Close Connection
        let consumerTransport = await Store.ConferenceKitchenConsumerTransport.findById(ctx, id);
        if (!consumerTransport || consumerTransport.state === 'closed') {
            throw Error('Unable to find connection');
        }
        consumerTransport.state = 'closed';
        await consumerTransport.flush(ctx);

        logger.log(ctx, 'ConsumerTransport Remove: ' + consumerTransport.pid);

        // Close End Stream
        let stream = (await Store.ConferenceEndStream.findById(ctx, id))!;
        stream.seq++;
        stream.state = 'completed';
        stream.remoteCandidates = [];
        stream.localCandidates = [];
        stream.localSdp = null;
        stream.remoteSdp = null;
        stream.localStreams = [];
        stream.remoteStreams = [];

        // Delete transport
        // Not deleting producer transports until we figure out how to deal with eventual consistency
        // await this.repo.deleteTransport(ctx, id);
    }

    //
    // Implementation
    //

    #onProducerTransportOffer = async (ctx: Context, transportId: string, offer: string, hints: StreamHint[]) => {

        // Find producer transport
        let producerTransport = await Store.ConferenceKitchenProducerTransport.findById(ctx, transportId);
        if (!producerTransport || producerTransport.state !== 'negotiation-need-offer') {
            return;
        }

        logger.log(ctx, 'ProducerTransport Received Offer: ' + producerTransport.pid);

        //
        // Parsing
        //
        let data = JSON.parse(offer);
        if (data.type !== 'offer') {
            throw Error('SDP is not an offer!');
        }
        let sdp = parseSDP(data.sdp as string);

        // Connect transport
        let fingerprints = extractFingerprints(sdp);
        if (fingerprints.length > 0) {
            await this.repo.connectTransport(ctx, transportId, 'server', fingerprints);
        } else {
            // Do nothing if no fingerprints present
            return;
        }

        //
        // Handle producers
        //
        let changed = false;
        for (let h of hints) {
            if (h.direction !== 'SEND') {
                throw Error('Incompatible hints');
            }
            let media = sdp.media.find((v) => (v.mid + '') === h.mid);

            // Check if hits are compatible
            if (!media) {
                throw Error('Inconsistent hints. Unable to find stream ' + h.mid);
            }

            // Check if direction valid
            if (media.direction !== 'sendonly' && media.direction !== 'inactive') {
                throw Error('Incompatible hints');
            }

            if (h.kind === 'audio') {
                if (!producerTransport.audioProducerMid) {
                    producerTransport.audioProducerMid = h.mid;
                } else {
                    if (producerTransport.audioProducerMid !== h.mid) {
                        throw Error('MID cant be changed');
                    }
                }
                if (!producerTransport.audioProducer) {
                    let rtpParameters = extractOpusRtpParameters(media);
                    let producerId = await this.repo.createProducer(ctx, transportId, { kind: 'audio', rtpParameters });
                    producerTransport.audioProducer = producerId;
                    changed = true;
                }
            } else if (h.kind === 'video') {
                if (h.videoSource === 'default') {
                    if (!producerTransport.videoProducerMid) {
                        producerTransport.videoProducerMid = h.mid;
                    } else {
                        if (producerTransport.videoProducerMid !== h.mid) {
                            throw Error('MID cant be changed');
                        }
                    }

                    if (!producerTransport.videoProducer) {
                        let rtpParameters = extractH264RtpParameters(media);
                        let producerId = await this.repo.createProducer(ctx, transportId, { kind: 'video', rtpParameters });
                        producerTransport.videoProducer = producerId;
                        changed = true;
                    }
                } else if (h.videoSource === 'screen') {
                    if (!producerTransport.screencastProducerMid) {
                        producerTransport.screencastProducerMid = h.mid;
                    } else {
                        if (producerTransport.screencastProducerMid !== h.mid) {
                            throw Error('MID cant be changed');
                        }
                    }

                    if (!producerTransport.screencastProducer) {
                        let rtpParameters = extractVP8RtpParameters(media);
                        let producerId = await this.repo.createProducer(ctx, transportId, { kind: 'video', rtpParameters });
                        producerTransport.screencastProducer = producerId;
                        changed = true;
                    }
                } else {
                    throw Error('Unknown video source: ' + h.videoSource);
                }
            } else {
                throw Error('Unknown kind: ' + h.kind);
            }
        }

        // Generate answer if ready
        producerTransport.state = 'negotiation-wait-answer';
        await producerTransport.flush(ctx);
        await this.#createProducerAnswerIfNeeded(ctx, transportId);

        if (changed) {
            // Update consumers
            let consumers = await Store.ConferenceKitchenConsumerTransport.fromConference.findAll(ctx, producerTransport.cid);
            for (let c of consumers) {
                if (c.consumes.find((v) => v === transportId)) {
                    await this.#refreshConsumerIfNeeded(ctx, c.id);
                }
            }
        }
    }

    #createProducerAnswerIfNeeded = async (ctx: Context, transportId: string) => {
        let producerTransport = await Store.ConferenceKitchenProducerTransport.findById(ctx, transportId);
        if (!producerTransport || producerTransport.state !== 'negotiation-wait-answer') {
            return;
        }
        let endStream = (await Store.ConferenceEndStream.findById(ctx, transportId))!;
        let transport = (await Store.KitchenTransport.findById(ctx, transportId))!;
        if (transport.state !== 'connected') {
            return;
        }

        // Check Audio Producer
        let audioProducer: KitchenProducer | null = null;
        if (producerTransport.audioProducer && producerTransport.audioProducerMid) {
            let producer = await Store.KitchenProducer.findById(ctx, producerTransport.audioProducer);
            if (!producer || producer.state !== 'created') {
                return; // Not created yet
            }
            audioProducer = producer;
        }

        // Check Video Producer
        let videoProducer: KitchenProducer | null = null;
        if (producerTransport.videoProducer && producerTransport.videoProducerMid) {
            let producer = await Store.KitchenProducer.findById(ctx, producerTransport.videoProducer);
            if (!producer || producer.state !== 'created') {
                return; // Not created yet
            }
            videoProducer = producer;
        }

        // Check Screencast Producer
        let screencastProducer: KitchenProducer | null = null;
        if (producerTransport.screencastProducer && producerTransport.screencastProducerMid) {
            let producer = await Store.KitchenProducer.findById(ctx, producerTransport.screencastProducer);
            if (!producer || producer.state !== 'created') {
                return; // Not created yet
            }
            screencastProducer = producer;
        }

        logger.log(ctx, 'ProducerTransport Sending Answer: ' + producerTransport.pid);

        //
        // Read Offer
        //
        let data = JSON.parse(endStream.localSdp!);
        if (data.type !== 'offer') {
            throw Error('SDP is not an offer!');
        }
        let sdp = parseSDP(data.sdp as string);

        // 
        // Resolve Answer
        //

        let iceCandidates = transport.serverParameters!.iceCandidates;

        let media: Array<{
            type: string;
            port: number;
            protocol: string;
            payloads?: string;
        } & MediaDescription> = [];

        // Generate media descriptors
        for (let m of sdp.media) {
            let mid = m.mid + '';
            if (audioProducer && mid === producerTransport.audioProducerMid) {
                media.push(createMediaDescription(mid, 'audio', m.port, 'recvonly', producerTransport.produces.audioStream, audioProducer!.rtpParameters!, iceCandidates));
            } else if (videoProducer && mid === producerTransport.videoProducerMid) {
                media.push(createMediaDescription(mid, 'video', m.port, 'recvonly', producerTransport.produces.videoStream, videoProducer!.rtpParameters!, iceCandidates));
            } else if (screencastProducer && mid === producerTransport.screencastProducerMid) {
                media.push(createMediaDescription(mid, 'video', m.port, 'recvonly', producerTransport.produces.screenCastStream, screencastProducer!.rtpParameters!, iceCandidates));
            } else {
                throw Error('Unknown media track');
            }
        }

        // 
        // Generate Answer
        //
        let answer = generateSDP(
            transport.serverParameters!.fingerprints,
            transport.serverParameters!.iceParameters,
            media
        );
        endStream.seq++;
        endStream.state = 'online';
        endStream.remoteSdp = JSON.stringify({ type: 'answer', sdp: answer });
        producerTransport.state = 'ready';
        await this.callRepo.bumpVersion(ctx, producerTransport.cid, producerTransport.pid);
    }

    #refreshConsumerIfNeeded = async (ctx: Context, transportId: string) => {
        let consumerTransport = await Store.ConferenceKitchenConsumerTransport.findById(ctx, transportId);
        if (!consumerTransport || consumerTransport.state === 'closed') {
            return;
        }
        let capabilities: Capabilities = consumerTransport.capabilities || DEFAULT_CAPABILITIES;
        let consumers: {
            pid: number,
            consumer: string,
            transport: string,
            active: boolean,
            media: { type: 'audio', } | { type: 'video', source: 'default' | 'screen' }
        }[] = [];
        let changed = false;

        logger.log(ctx, 'ConsumerTransport restart if needed: ' + consumerTransport.pid);

        // Update active state of existing consumers
        for (let c of consumerTransport.consumers) {
            let consumable = !!consumerTransport.consumes.find((v) => v === c.transport);

            // Check if producer paused
            if (consumable) {
                let producerTransport = (await Store.ConferenceKitchenProducerTransport.findById(ctx, c.transport))!;
                if (producerTransport.state === 'closed') {
                    consumable = false;
                } else {
                    if (c.media.type === 'audio') {
                        consumable = producerTransport.produces.audioStream;
                    } else if (c.media.type === 'video' && c.media.source === 'default') {
                        consumable = producerTransport.produces.videoStream;
                    } else if (c.media.type === 'video' && c.media.source === 'screen') {
                        consumable = producerTransport.produces.screenCastStream;
                    }
                }
            }

            // If not consumable: disable if needed
            if (!consumable) {
                if (!c.active) {
                    consumers.push(c);
                } else {
                    consumers.push({
                        ...c,
                        active: false
                    });
                    changed = true;
                }
            }

            // If consumable: enable if needed
            if (consumable) {
                if (c.active) {
                    consumers.push(c);
                } else {
                    consumers.push({
                        ...c,
                        active: true
                    });
                    changed = true;
                }
            }
        }

        // Add new consumers
        for (let c of consumerTransport.consumes) {
            let producerTransport = (await Store.ConferenceKitchenProducerTransport.findById(ctx, c));
            if (!producerTransport || producerTransport.state === 'closed') {
                continue;
            }

            // Add audio producer if needed
            if (producerTransport.audioProducer) {
                if (producerTransport.produces.audioStream) {
                    if (!consumers.find((v) => v.pid === producerTransport!.pid && v.media.type === 'audio')) {
                        let consumer = await this.repo.createConsumer(ctx, transportId, producerTransport.audioProducer, { rtpCapabilities: getAudioRtpCapabilities(capabilities), paused: true });
                        consumers.push({
                            pid: producerTransport.pid,
                            consumer,
                            transport: c,
                            active: true,
                            media: { type: 'audio' }
                        });
                        changed = true;
                    }
                }
            }

            // Add video producer if needed
            if (producerTransport.videoProducer) {
                if (producerTransport.produces.videoStream) {
                    if (!consumers.find((v) => v.pid === producerTransport!.pid && v.media.type === 'video' && v.media.source === 'default')) {
                        let caps = getVideoCapabilities(capabilities);
                        let consumer = await this.repo.createConsumer(ctx, transportId, producerTransport.videoProducer, { rtpCapabilities: caps, paused: true });
                        consumers.push({
                            pid: producerTransport.pid,
                            consumer,
                            transport: c,
                            active: true,
                            media: { type: 'video', source: 'default' }
                        });
                        changed = true;
                    }
                }
            }

            // Add screencast producer if needed
            if (producerTransport.screencastProducer) {
                if (producerTransport.produces.screenCastStream) {
                    if (!consumers.find((v) => v.pid === producerTransport!.pid && v.media.type === 'video' && v.media.source === 'screen')) {
                        let caps = getVideoCapabilities(capabilities);
                        let consumer = await this.repo.createConsumer(ctx, transportId, producerTransport.screencastProducer, { rtpCapabilities: caps, paused: true });
                        consumers.push({
                            pid: producerTransport.pid,
                            consumer,
                            transport: c,
                            active: true,
                            media: { type: 'video', source: 'screen' }
                        });
                        changed = true;
                    }
                }
            }
        }

        // Try to regenerate new offer
        if (changed) {
            logger.log(ctx, 'ConsumerTransport Restart: ' + consumerTransport.pid);
            consumerTransport.consumers = consumers;
            consumerTransport.state = 'negotiation-wait-offer';
            await consumerTransport.flush(ctx);
            await this.#createConsumerOfferIfNeeded(ctx, transportId);
        } else {
            logger.log(ctx, 'ConsumerTransport restart NOT needed: ' + consumerTransport.pid);
        }
    }

    #createConsumerOfferIfNeeded = async (ctx: Context, transportId: string) => {
        let consumerTransport = await Store.ConferenceKitchenConsumerTransport.findById(ctx, transportId);
        if (!consumerTransport || consumerTransport.state !== 'negotiation-wait-offer') {
            return;
        }
        let endStream = (await Store.ConferenceEndStream.findById(ctx, transportId))!;
        let transport = (await Store.KitchenTransport.findById(ctx, transportId))!;
        if (transport.state !== 'created' && transport.state !== 'connecting' && transport.state !== 'connected') {
            return;
        }

        // Check if all consumers are ready
        for (let consumer of consumerTransport.consumers) {
            let cc = (await Store.KitchenConsumer.findById(ctx, consumer.consumer))!;
            if (cc.state !== 'created') {
                return;
            }
        }

        logger.log(ctx, 'ConsumerTransport Create Offer: ' + consumerTransport.pid);

        let iceCandidates = transport.serverParameters!.iceCandidates;

        // Media
        let media: Array<{
            type: string;
            port: number;
            protocol: string;
            payloads?: string;
        } & MediaDescription> = [];
        let remoteStreams: ({
            pid: number,
            media: { type: 'audio', mid: string } | { type: 'video', source: 'default' | 'screen', mid: string }
        })[] = [];
        for (let consumer of consumerTransport.consumers) {
            let cc = (await Store.KitchenConsumer.findById(ctx, consumer.consumer))!;
            let mid = cc.rtpParameters!.mid!;
            if (!cc.rtpParameters!.mid) {
                throw Error('Missing MID in consumer');
            }
            if (consumer.media.type === 'audio') {
                media.push(createMediaDescription(mid, 'audio', 7, 'sendonly', consumer.active, cc.rtpParameters!, iceCandidates));
                remoteStreams.push({
                    pid: consumer.pid,
                    media: { type: 'audio', mid }
                });
            } else if (consumer.media.type === 'video' && consumer.media.source === 'default') {
                media.push(createMediaDescription(mid, 'video', 7, 'sendonly', consumer.active, cc.rtpParameters!, iceCandidates));
                remoteStreams.push({
                    pid: consumer.pid,
                    media: { type: 'video', mid, source: 'default' }
                });
            } else if (consumer.media.type === 'video' && consumer.media.source === 'screen') {
                media.push(createMediaDescription(mid, 'video', 7, 'sendonly', consumer.active, cc.rtpParameters!, iceCandidates));
                remoteStreams.push({
                    pid: consumer.pid,
                    media: { type: 'video', mid, source: 'screen' }
                });
            }
        }

        // 
        // Generate Answer
        //
        let answer = generateSDP(
            transport.serverParameters!.fingerprints,
            transport.serverParameters!.iceParameters,
            media
        );
        endStream.seq++;
        endStream.state = 'need-answer';
        endStream.remoteSdp = JSON.stringify({ type: 'offer', sdp: answer });
        endStream.remoteStreams = remoteStreams;
        consumerTransport.state = 'negotiation-need-answer';
        await this.callRepo.bumpVersion(ctx, consumerTransport.cid, consumerTransport.pid);
    }

    #consumerTransportAnswer = async (ctx: Context, transportId: string, answer: string) => {
        // Find consumer transport
        let consumerTransport = await Store.ConferenceKitchenConsumerTransport.findById(ctx, transportId);
        if (!consumerTransport || consumerTransport.state === 'closed' || consumerTransport.state === 'ready') {
            return;
        }

        logger.log(ctx, 'ConsumerTransport Received Answer: ' + consumerTransport.pid);

        //
        // Parsing
        //
        let data = JSON.parse(answer);
        if (data.type !== 'answer') {
            throw Error('SDP is not an offer!');
        }
        let sdp = parseSDP(data.sdp as string);

        // Connect transport
        let fingerprints = extractFingerprints(sdp);
        if (fingerprints.length > 0) {
            consumerTransport.state = 'ready';
            await this.repo.connectTransport(ctx, transportId, 'client', fingerprints);
        }

        // Unpause consumers
        for (let media of sdp.media) {
            let index = parseInt(media.mid! + '', 10);
            await this.repo.unpauseConsumer(ctx, consumerTransport.consumers[index].consumer);
        }
    }

    //
    // Callbacks
    //

    onWebRTCConnectionOffer = async (ctx: Context, transportId: string, offer: string, hints: StreamHint[] | null) => {
        if (!hints) {
            throw Error('Unsupported client');
        }

        await this.#onProducerTransportOffer(ctx, transportId, offer, hints);
    }

    onWebRTCConnectionAnswer = async (ctx: Context, transportId: string, answer: string) => {
        await this.#consumerTransportAnswer(ctx, transportId, answer);
    }

    onKitchenTransportCreated = async (ctx: Context, transportId: string) => {
        await this.#createProducerAnswerIfNeeded(ctx, transportId);
        await this.#createConsumerOfferIfNeeded(ctx, transportId);
    }

    onKitchenTransportConnected = async (ctx: Context, transportId: string) => {
        await this.#createProducerAnswerIfNeeded(ctx, transportId);
    }

    onKitchenProducerCreated = async (ctx: Context, transportId: string, producerId: string) => {
        await this.#createProducerAnswerIfNeeded(ctx, transportId);
    }

    onKitchenConsumerCreated = async (ctx: Context, transportId: string, consumerId: string) => {
        await this.#createConsumerOfferIfNeeded(ctx, transportId);
    }
}