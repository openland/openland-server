import { createLogger } from '@openland/log';
import { KitchenRtpParameters, KitchenIceCandidate } from '../kitchen/types';
import { writeSDP } from 'openland-module-calls/sdp/writeSDP';
import { SDP } from '../sdp/SDP';
import { KitchenProducer } from '../../openland-module-db/store';
import { parseSDP } from 'openland-module-calls/sdp/parseSDP';
import { Store } from 'openland-module-db/FDB';
import { MediaSources, StreamHint, ProducerDescriptor } from './CallScheduler';
import { Context } from '@openland/context';
import { CallRepository } from './CallRepository';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import uuid from 'uuid/v4';
import { extractFingerprints } from 'openland-module-calls/sdp/extractFingerprints';
import { extractOpusRtpParameters, extractH264RtpParameters, convertParameters, convertIceCandidate } from 'openland-module-calls/kitchen/extract';
import { MediaDescription } from 'sdp-transform';

const logger = createLogger('calls-kitchen');

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
    rtpParameters: KitchenRtpParameters,
    iceCandidates: KitchenIceCandidate[],
): {
    type: string;
    port: number;
    protocol: string;
    payloads?: string;
} & MediaDescription {
    return {
        mid,
        type,
        protocol: 'UDP/TLS/RTP/SAVPF',
        payloads: rtpParameters.codecs[0].payloadType.toString(),
        port,
        rtcpMux: 'rtcp-mux',
        rtcpRsize: 'rtcp-rsize',
        direction,

        // Codec
        rtp: [type === 'audio' ? {
            payload: rtpParameters.codecs[0].payloadType,
            rate: rtpParameters.codecs[0].clockRate,
            encoding: 2,
            codec: 'opus',
        } : {
                payload: rtpParameters.codecs[0].payloadType,
                rate: rtpParameters.codecs[0].clockRate,
                codec: 'H264'
            }],
        fmtp: [{
            payload: rtpParameters.codecs[0].payloadType,
            config: convertParameters(rtpParameters.codecs[0].parameters || {})
        }],
        rtcpFb: rtpParameters.codecs[0].rtcpFeedback!.map((v) => ({
            payload: rtpParameters.codecs[0].payloadType,
            type: v.type,
            subtype: v.parameter ? v.parameter : undefined
        })),

        // ICE + DTLS
        setup: direction === 'sendonly' ? 'actpass' : 'active',
        connection: { ip: '0.0.0.0', version: 4 },
        candidates: iceCandidates.map((v) => convertIceCandidate(v)),
        endOfCandidates: 'end-of-candidates',
        ...{ iceOptions: 'renomination' },
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

    createProducerTransport = async (ctx: Context, router: string, cid: number, pid: number, produces: MediaSources) => {
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
            iceTransportPolicy: 'none'
        });

        // Producer transport
        await Store.ConferenceKitchenProducerTransport.create(ctx, id, {
            pid,
            cid,
            produces,

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

    createConsumerTransport = async (ctx: Context, router: string, cid: number, pid: number, consumes: string[]) => {
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
            if (producerTransport.audioProducer) {
                let consumer = await this.repo.createConsumer(ctx, id, producerTransport.audioProducer, {
                    rtpCapabilities: {
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
                            rtcpFeedback: [{
                                type: 'transport-cc'
                            }]
                        }]
                    }
                });
                consumers.push({
                    pid: producerTransport.pid,
                    consumer,
                    transport,
                    active: true,
                    media: { type: 'audio' }
                });
            }

            // TODO: Implement video
        }

        // Consumer transport
        await Store.ConferenceKitchenConsumerTransport.create(ctx, id, {
            pid,
            cid,
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
            iceTransportPolicy: 'none'
        });

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
        await this.repo.deleteTransport(ctx, id);
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
                        let rtpParameters = extractH264RtpParameters(media);
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
                media.push(createMediaDescription(mid, 'audio', m.port, 'recvonly', audioProducer!.rtpParameters!, iceCandidates));
            } else if (videoProducer && mid === producerTransport.videoProducerMid) {
                media.push(createMediaDescription(mid, 'video', m.port, 'recvonly', videoProducer!.rtpParameters!, iceCandidates));
            } else if (screencastProducer && mid === producerTransport.screencastProducerMid) {
                media.push(createMediaDescription(mid, 'video', m.port, 'recvonly', screencastProducer!.rtpParameters!, iceCandidates));
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
        // TODO: Implement
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
        let index = 0;
        for (let consumer of consumerTransport.consumers) {
            let cc = (await Store.KitchenConsumer.findById(ctx, consumer.consumer))!;
            let mid = index + '';
            if (consumer.media.type === 'audio') {
                media.push(createMediaDescription(mid, 'audio', 7, 'sendonly', cc.rtpParameters!, iceCandidates));
                remoteStreams.push({
                    pid: consumer.pid,
                    media: { type: 'audio', mid }
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
        } else {
            // Do nothing if no fingerprints present
            return;
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