import { KitchenProducer } from 'openland-module-db/store';
import { KitchenIceCandidate, KitchenRtpParameters } from './../kitchen/types';
import { createLogger } from '@openland/log';
import { SDP } from './../sdp/SDP';
import uuid from 'uuid/v4';
import { Store } from 'openland-module-db/FDB';
import { CallRepository } from './CallRepository';
import { Context } from '@openland/context';
import { MediaKitchenRepository } from './../kitchen/MediaKitchenRepository';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { parseSDP } from 'openland-module-calls/sdp/parseSDP';
import { extractFingerprints } from '../sdp/extractFingerprints';
import { MediaSources, StreamHint, ProducerDescriptor, ProducerReference } from './CallScheduler';
import { writeSDP } from 'openland-module-calls/sdp/writeSDP';
import { MediaDescription } from 'sdp-transform';
import { RtpParameters, RtpCapabilities } from 'mediakitchen';

const logger = createLogger('calls-kitchen');

function clone<T>(src: T): T {
    return JSON.parse(JSON.stringify(src));
}

function convertParameters(src: any) {
    return Object.keys(src).map((key) => `${key}=${src[key]}`).join(';');
}

function convertIceCandidate(src: KitchenIceCandidate) {
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

function decodeParameters(src: string) {
    let params: any = {};
    let parts = src.split(';');
    for (let p of parts) {
        let kv = p.split('=');
        params[kv[0]] = kv[1];
    }
    return params;
}

function getOpusRtpParameters(src: MediaDescription): RtpParameters {

    // Find codec
    const codec = src.rtp.find((v) => v.codec === 'opus');
    if (!codec) {
        throw Error('Unable to find opus codec!');
    }

    // Find ssrc
    let ssrc = src.ssrcs![0].id as number;

    // Resolve Parameters
    let params: any = {};
    let fmt = src.fmtp.find((v) => v.payload === codec.payload);
    if (fmt) {
        params = decodeParameters(fmt.config);
    }
    params = {
        ...params,
        useinbandfec: 1, // Enable In-Band Forward Error Correction
        stereo: 0, // Disable stereo
        usedtx: 1 // Reduce bitrate during silence
    };

    // Create Producer
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

    return {
        codecs: [codecParameters],
        encodings: [{ ssrc: ssrc }]
    };
}

function getOpusRtpCapabilities(src: MediaDescription): RtpCapabilities {

    // Find codec
    const codec = src.rtp.find((v) => v.codec === 'opus');
    if (!codec) {
        throw Error('Unable to find opus codec!');
    }

    // Resolve Parameters
    let params: any = {};
    let fmt = src.fmtp.find((v) => v.payload === codec.payload);
    if (fmt) {
        params = decodeParameters(fmt.config);
    }
    params = {
        ...params,
        useinbandfec: 1, // Enable In-Band Forward Error Correction
        stereo: 0, // Disable stereo
        usedtx: 1 // Reduce bitrate during silence
    };

    // Create Producer
    let codecCapabilities = {
        kind: 'audio' as 'audio' | 'video',
        mimeType: 'audio/opus',
        payloadType: codec.payload,
        clockRate: 48000,
        channels: 2,
        parameters: params,
        rtcpFeedback: [{
            type: 'transport-cc'
        }]
    };

    return {
        codecs: [codecCapabilities]
    };
}

function getH264RtpParameters(src: MediaDescription): RtpParameters {

    // Resolving a codec
    let codecPayload: number | null = null;
    for (let c of src.rtp) {
        if (c.codec !== 'H264') {
            continue;
        }
        let fmt2 = src.fmtp.find((f) => f.payload === c.payload);
        if (!fmt2) {
            continue;
        }
        let cfg = decodeParameters(fmt2.config);
        if (cfg['packetization-mode'] !== '1') {
            continue;
        }
        if (cfg['profile-level-id'] !== '42e034' && cfg['profile-level-id'] !== '42e01f') {
            continue;
        }
        codecPayload = c.payload;
        break;
    }
    if (codecPayload === null) {
        throw Error('Unable to find vide codec');
    }
    let codec = src.rtp.find((v) => v.payload === codecPayload)!;
    if (!codec) {
        throw Error('Unable to find codec!');
    }

    // Find ssrc
    let ssrc = src.ssrcs![0].id as number;

    // Resolve Param
    let params: any = {};
    let fmt = src.fmtp.find((v) => v.payload === codec.payload);
    if (fmt) {
        params = decodeParameters(fmt.config);
    }
    params['profile-level-id'] = '42e01f';
    params['packetization-mode'] = 1;
    params['level-asymmetry-allowed'] = 1;

    // Create Producer
    let codecParameters = {
        mimeType: 'video/H264',
        payloadType: codec.payload,
        clockRate: 90000,
        parameters: params,
        rtcpFeedback: [{
            type: 'transport-cc'
        }]
    };

    return {
        codecs: [codecParameters],
        encodings: [{ ssrc: ssrc }]
    };
}

function getH264RtpCapabilities(src: MediaDescription): RtpCapabilities {

    // Resolving a codec
    let codecPayload: number | null = null;
    for (let c of src.rtp) {
        if (c.codec !== 'H264') {
            continue;
        }
        let fmt2 = src.fmtp.find((f) => f.payload === c.payload);
        if (!fmt2) {
            continue;
        }
        let cfg = decodeParameters(fmt2.config);
        if (cfg['packetization-mode'] !== '1') {
            continue;
        }
        if (cfg['profile-level-id'] !== '42e034' && cfg['profile-level-id'] !== '42e01f') {
            continue;
        }
        codecPayload = c.payload;
        break;
    }
    if (codecPayload === null) {
        throw Error('Unable to find vide codec');
    }
    let codec = src.rtp.find((v) => v.payload === codecPayload)!;
    if (!codec) {
        throw Error('Unable to find codec!');
    }

    // Resolve Param
    let params: any = {};
    let fmt = src.fmtp.find((v) => v.payload === codec.payload);
    if (fmt) {
        params = decodeParameters(fmt.config);
    }
    params['profile-level-id'] = '42e01f';
    params['packetization-mode'] = 1;
    params['level-asymmetry-allowed'] = 1;

    // Create Producer
    let codecParameters = {
        kind: 'video' as 'video' | 'audio',
        mimeType: 'video/H264',
        payloadType: codec.payload,
        clockRate: 90000,
        parameters: params,
        rtcpFeedback: [{
            type: 'transport-cc'
        }]
    };

    return {
        codecs: [codecParameters]
    };
}

@injectable()
export class CallSchedulerKitchenConnections {

    @lazyInject('MediaKitchenRepository')
    readonly repo!: MediaKitchenRepository;

    @lazyInject('CallRepository')
    readonly callRepo!: CallRepository;

    //
    // Operations
    //

    createConnection = async (ctx: Context, cid: number, pid: number, produces: MediaSources, consumes: string[]) => {

        // Connection Id
        let id = uuid();

        logger.log(ctx, 'Create connection: ' + id + ' -> ' + JSON.stringify(consumes));

        // Conference Router
        let router = (await Store.ConferenceKitchenRouter.conference.find(ctx, cid))!;

        // Connection transport
        await this.repo.createTransport(ctx, id, router.id);

        // Producers/Producer References
        let initialProducers = this.#getProducerDescriptors(produces);
        let initialProducerReferences = await this.#getActiveProducers(ctx, consumes);

        // End stream
        await Store.ConferenceEndStream.create(ctx, id, {
            pid,
            seq: 1,
            state: 'need-offer',
            localCandidates: [],
            remoteCandidates: [],
            localSdp: null,
            remoteSdp: null,
            localStreams: initialProducers,
            remoteStreams: initialProducerReferences.map((v) => ({ pid: v.pid, media: v.media })),
            iceTransportPolicy: 'none'
        });

        //
        // Create Connection
        // 
        // NOTE: 
        //      * Producers are not created here - need an offer first.
        //      * Consumers are NOT all possible consumers, but list of **created** producers from
        //        connected connections. Actual consumers will be created after offer received.
        //
        await Store.ConferenceKitchenConnection.create(ctx, id, {
            pid, cid,
            produces,
            consumes,

            // Waiting for offer
            state: 'negotiation-need-offer',
            audioProducer: null,
            audioProducerMid: null,
            videoProducer: null,
            videoProducerMid: null,
            screencastProducer: null,
            screencastProducerMid: null,
            consumers: initialProducerReferences.map((v) => ({
                pid: v.pid,
                media: v.media,
                connection: v.connection,
                consumer: null
            }))
        });

        // Bump
        await this.callRepo.bumpVersion(ctx, cid, pid);

        return id;
    }

    updateConsumes = async (ctx: Context, id: string, consumes: string[]) => {
        // TODO: Implement
        logger.log(ctx, 'Update connection: ' + id + ' -> ' + JSON.stringify(consumes));
    }

    updateProduces = async (ctx: Context, id: string, sources: MediaSources) => {
        // TODO: Implement
    }

    removeConnection = async (ctx: Context, id: string) => {
        logger.log(ctx, 'Remove connection: ' + id);

        // Close Connection
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, id);
        if (!connection || connection.state === 'closed') {
            throw Error('Unable to find connection');
        }
        connection.state = 'closed';
        await connection.flush(ctx);

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
        // await this.repo.deleteTransport(ctx, id);

        // Bump
        await this.callRepo.bumpVersion(ctx, connection.cid, connection.pid);
    }

    //
    // Tools
    //

    /**
     * Get Active producer references from list ofconnections
     */
    #getActiveProducers = async (ctx: Context, connections: string[]) => {
        let res: ProducerReference[] = [];
        for (let c of connections) {
            let connection = await Store.ConferenceKitchenConnection.findById(ctx, c);
            if (!connection) {
                continue;
            }
            if (connection.state === 'closed') {
                continue;
            }
            if (connection.audioProducer) {
                res.push({
                    pid: connection.pid,
                    connection: connection.id,
                    producer: connection.audioProducer,
                    media: {
                        mid: null,
                        type: 'audio',
                    }
                });
            }
            if (connection.videoProducer) {
                res.push({
                    pid: connection.pid,
                    connection: connection.id,
                    producer: connection.videoProducer,
                    media: {
                        mid: null,
                        type: 'video',
                        source: 'default'
                    }
                });
            }
            if (connection.screencastProducer) {
                res.push({
                    pid: connection.pid,
                    connection: connection.id,
                    producer: connection.screencastProducer,
                    media: {
                        mid: null,
                        type: 'video',
                        source: 'screen'
                    }
                });
            }
        }
        return res;
    }

    /**
     * Resolve producer configuration from MediaSources
     */
    #getProducerDescriptors = (streams: MediaSources): ProducerDescriptor[] => {
        let res: ProducerDescriptor[] = [];
        if (streams.videoStream) {
            res.push({ type: 'video', codec: 'h264', source: 'default', mid: null });
        }
        if (streams.screenCastStream) {
            res.push({ type: 'video', codec: 'h264', source: 'screen', mid: null });
        }
        if (streams.audioStream) {
            res.push({ type: 'audio', codec: 'opus', mid: null });
        }
        return res;
    }

    /**
     * Get producer by id if it is created
     */
    #getActiveProducer = async (ctx: Context, id: string) => {
        let producer = await Store.KitchenProducer.findById(ctx, id);
        if (!producer) {
            return null;
        }
        if (producer.state === 'created') {
            return producer;
        }
        return null;
    }

    #getActiveConsumer = async (ctx: Context, id: string) => {
        let consumer = await Store.KitchenConsumer.findById(ctx, id);
        if (!consumer) {
            return null;
        }
        if (consumer.state === 'created') {
            return consumer;
        }
        return null;
    }

    //
    // Producer Offer/Answer
    //

    #onTransportOffer = async (ctx: Context, id: string, offer: string, hints: StreamHint[]) => {

        // Check if connection exists and is waiting for offer
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, id);
        if (!connection || connection.state !== 'negotiation-need-offer') {
            return;
        }

        // Check if end stream exists
        let endStream = await Store.ConferenceEndStream.findById(ctx, id);
        if (!endStream) {
            return;
        }

        // Check if kitchen transport exists
        let transport = await Store.KitchenTransport.findById(ctx, id);
        if (!transport || transport.state === 'deleted' || transport.state === 'deleting') {
            return;
        }

        // Parsing
        let data = JSON.parse(offer);
        if (data.type !== 'offer') {
            throw Error('SDP is not an offer!');
        }
        let sdp = parseSDP(data.sdp as string);

        // Check if offer is not empty
        let fingerprints = extractFingerprints(sdp);
        if (fingerprints.length > 0) {
            await this.repo.connectTransport(ctx, id, fingerprints);
        } else {
            return;
        }

        // Create producers if needed
        for (let h of hints) {
            if (h.direction !== 'SEND') {
                continue;
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
                if (!connection.audioProducerMid) {
                    connection.audioProducerMid = h.mid;
                } else {
                    if (connection.audioProducerMid !== h.mid) {
                        throw Error('MID cant be changed');
                    }
                }
                if (!connection.audioProducer) {
                    let rtpParameters = getOpusRtpParameters(media);
                    let producerId = await this.repo.createProducer(ctx, id, { kind: 'audio', rtpParameters });
                    await Store.ConferenceKitchenProducerRef.create(ctx, producerId, { connection: connection.id });
                    connection.audioProducer = producerId;
                }
            } else if (h.kind === 'video') {
                if (h.videoSource === 'default') {
                    if (!connection.videoProducerMid) {
                        connection.videoProducerMid = h.mid;
                    } else {
                        if (connection.videoProducerMid !== h.mid) {
                            throw Error('MID cant be changed');
                        }
                    }

                    if (!connection.videoProducer) {
                        let rtpParameters = getH264RtpParameters(media);
                        let producerId = await this.repo.createProducer(ctx, id, { kind: 'video', rtpParameters });
                        await Store.ConferenceKitchenProducerRef.create(ctx, producerId, { connection: connection.id });
                        connection.videoProducer = producerId;
                    }
                } else if (h.videoSource === 'screen') {
                    if (!connection.screencastProducerMid) {
                        connection.screencastProducerMid = h.mid;
                    } else {
                        if (connection.screencastProducerMid !== h.mid) {
                            throw Error('MID cant be changed');
                        }
                    }

                    if (!connection.screencastProducer) {
                        let rtpParameters = getH264RtpParameters(media);
                        let producerId = await this.repo.createProducer(ctx, id, { kind: 'video', rtpParameters });
                        await Store.ConferenceKitchenProducerRef.create(ctx, producerId, { connection: connection.id });
                        connection.screencastProducer = producerId;
                    }
                } else {
                    throw Error('Unknown video source: ' + h.videoSource);
                }
            } else {
                throw Error('Unknown kind: ' + h.kind);
            }
        }

        // Create consumers if needed
        for (let h of hints) {
            if (h.direction !== 'RECEIVE') {
                continue;
            }
            if (!h.peerId) {
                continue;
            }
            let media = sdp.media.find((v) => (v.mid + '') === h.mid);

            // Check if hits are compatible
            if (!media) {
                throw Error('Inconsistent hints');
            }

            // Check if direction valid
            if (media.direction !== 'recvonly' && media.direction !== 'inactive') {
                throw Error('Incompatible hints');
            }

            let consumerIndex = connection.consumers.findIndex((v) => v.pid === h.peerId &&
                (
                    /* Audio Stream */(v.media.type === 'audio' && h.kind === 'audio')
                    /* Video Stream */ || (v.media.type === 'video' && v.media.source === 'default' && h.kind === 'video' && (h.videoSource === null || h.videoSource === 'default'))
                    /* Screen Stream*/ || (v.media.type === 'video' && v.media.source === 'screen' && h.kind === 'video' && (h.videoSource === null || h.videoSource === 'screen'))
                )
            );
            if (consumerIndex < 0) {
                throw Error('Invalid hints');
            }

            // Create consumer if needed
            let consumer = clone(connection.consumers[consumerIndex]);
            if (!consumer.consumer) {
                consumer.media.mid = h.mid;
                let srcConnection = await Store.ConferenceKitchenConnection.findById(ctx, consumer.connection);
                if (!srcConnection) {
                    throw Error('Unknown error');
                }

                if (h.kind === 'audio') {
                    if (!srcConnection.audioProducer) {
                        throw Error('Unknown error');
                    }
                    let rtpCapabilities = getOpusRtpCapabilities(media);
                    let consumerId = await this.repo.createConsumer(ctx, id, srcConnection.audioProducer!, { rtpCapabilities });
                    await Store.ConferenceKitchenConsumerRef.create(ctx, consumerId, { connection: connection.id });
                    consumer.consumer = consumerId;
                } else if (h.kind === 'video') {
                    if (h.videoSource === null || h.videoSource === 'default') {
                        if (!srcConnection.videoProducer) {
                            throw Error('Unknown error');
                        }
                        let rtpCapabilities = getH264RtpCapabilities(media);
                        let consumerId = await this.repo.createConsumer(ctx, id, srcConnection.videoProducer!, { rtpCapabilities });
                        await Store.ConferenceKitchenConsumerRef.create(ctx, consumerId, { connection: connection.id });
                        consumer.consumer = consumerId;
                    } else if (h.videoSource === 'screen') {
                        if (!srcConnection.screencastProducer) {
                            throw Error('Unknown error');
                        }
                        let rtpCapabilities = getH264RtpCapabilities(media);
                        let consumerId = await this.repo.createConsumer(ctx, id, srcConnection.screencastProducer!, { rtpCapabilities });
                        await Store.ConferenceKitchenConsumerRef.create(ctx, consumerId, { connection: connection.id });
                        consumer.consumer = consumerId;
                    } else {
                        throw Error('Unknown vbideo source');
                    }
                } else {
                    throw Error('Unknown kind');
                }
            } else if (consumer.media.mid !== h.mid) {
                throw Error('MID cant be changed');
            } else {
                continue;
            }

            // Apply storage
            let updated = [...connection.consumers];
            updated[consumerIndex] = consumer;
            connection.consumers = updated;
        }

        // Generate answer if ready
        connection.state = 'negotiation-wait-answer';
        await connection.flush(ctx);
        await this.#checkTransportAnswer(ctx, id);
    }

    #checkTransportAnswer = async (ctx: Context, id: string) => {

        logger.log(ctx, 'Check transport answer');

        let connection = await Store.ConferenceKitchenConnection.findById(ctx, id);
        // If answer is needed
        if (!connection || connection.state !== 'negotiation-wait-answer') {
            return;
        }
        // If end stream exists
        let endStream = await Store.ConferenceEndStream.findById(ctx, id);
        if (!endStream) {
            return;
        }
        // If end stream is in correct state
        if (endStream.state !== 'wait-answer') {
            return;
        }

        // If transport already connected
        // TODO: Handle answer generation before connected state since it could be empty transport
        let transport = await Store.KitchenTransport.findById(ctx, id);
        if (!transport || transport.state !== 'connected') {
            return;
        }

        // Check Audio Producer
        let audioProducer: KitchenProducer | null = null;
        if (connection.produces.audioStream) {
            if (connection.audioProducer && connection.audioProducerMid) {
                let producer = await this.#getActiveProducer(ctx, connection.audioProducer);
                if (!producer) {
                    return; // Not created yet
                }
                audioProducer = producer;
            } else {
                return; // Should not happen
            }
        }

        // Check Video Producer
        let videoProducer: KitchenProducer | null = null;
        if (connection.produces.videoStream) {
            if (connection.videoProducer && connection.videoProducerMid) {
                let producer = await this.#getActiveProducer(ctx, connection.videoProducer);
                if (!producer) {
                    return; // Not created yet
                }
                videoProducer = producer;
            } else {
                return; // Should not happen
            }
        }

        // Check Screencast Producer
        let screencastProducer: KitchenProducer | null = null;
        if (connection.produces.screenCastStream) {
            if (connection.screencastProducer && connection.screencastProducerMid) {
                let producer = await this.#getActiveProducer(ctx, connection.screencastProducer);
                if (!producer) {
                    return; // Not created yet
                }
                screencastProducer = producer;
            } else {
                return; // Should not happen
            }
        }

        for (let c of connection.consumers) {
            if (c.consumer && c.media.mid) {
                let consumer = await this.#getActiveConsumer(ctx, c.consumer);
                if (!consumer) {
                    return; // Not created yet
                }
            } else {
                return; // Should not happen
            }
        }

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

        let fingerprints = transport.serverParameters!.fingerprints;
        let iceParameters = transport.serverParameters!.iceParameters;
        let iceCandidates = transport.serverParameters!.iceCandidates;

        let media: Array<{
            type: string;
            port: number;
            protocol: string;
            payloads?: string;
        } & MediaDescription> = [];

        function createMediaDescription(mid: string, type: 'video' | 'audio', port: number, direction: 'recvonly' | 'sendonly', rtpParameters: KitchenRtpParameters): {
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
                setup: 'active',
                connection: { ip: '0.0.0.0', version: 4 },
                candidates: iceCandidates.map((v) => convertIceCandidate(v)),
                endOfCandidates: 'end-of-candidates',
                ...{ iceOptions: 'renomination' },
            };
        }

        // Generate media descriptors
        for (let m of sdp.media) {
            let mid = m.mid + '';
            if (audioProducer && mid === connection.audioProducerMid) {
                media.push(createMediaDescription(mid, 'audio', m.port, 'recvonly', audioProducer!.rtpParameters!));
            } else if (videoProducer && mid === connection.videoProducerMid) {
                media.push(createMediaDescription(mid, 'video', m.port, 'recvonly', videoProducer!.rtpParameters!));
            } else if (screencastProducer && mid === connection.screencastProducerMid) {
                media.push(createMediaDescription(mid, 'video', m.port, 'recvonly', screencastProducer!.rtpParameters!));
            } else {
                let consumer = connection.consumers.find((v) => v.media.mid === mid)!;
                let consumerInstance = await Store.KitchenConsumer.findById(ctx, consumer.consumer!);
                media.push(createMediaDescription(mid, consumer.media.type === 'audio' ? 'audio' : 'video', m.port, 'sendonly', consumerInstance!.rtpParameters!));
            }
        }

        // 
        // Generate Answer
        //

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
            groups: [{ type: 'BUNDLE', mids: media.map((v) => v.mid!).join(' ') }],
            media: media
        };

        // Write SDP
        endStream.seq++;
        endStream.state = 'online';
        endStream.remoteSdp = JSON.stringify({ type: 'answer', sdp: writeSDP(answer) });
        await this.callRepo.bumpVersion(ctx, connection.cid, connection.pid);

        // Update connection state
        connection.state = 'ready';
    }

    //
    // Callbacks
    //

    onWebRTCConnectionOffer = async (ctx: Context, id: string, offer: string, hints: StreamHint[] | null) => {
        if (!hints) {
            throw Error('Unsupported client');
        }
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, id);
        if (!connection || connection.state === 'closed') {
            return;
        }
        await this.#onTransportOffer(ctx, id, offer, hints);
    }

    onKitchenTransportCreated = async (ctx: Context, id: string) => {
        await this.#checkTransportAnswer(ctx, id);
    }

    onKitchenProducerCreated = async (ctx: Context, producerId: string) => {
        let ref = await Store.ConferenceKitchenProducerRef.findById(ctx, producerId);
        if (!ref) {
            return;
        }
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, ref.connection);
        if (!connection || connection.state === 'closed') {
            return;
        }
        await this.#checkTransportAnswer(ctx, ref.connection);
    }

    onKitchenConsumerCreated = async (ctx: Context, consumerId: string) => {
        let ref = await Store.ConferenceKitchenConsumerRef.findById(ctx, consumerId);
        if (!ref) {
            return;
        }
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, ref.connection);
        if (!connection || connection.state === 'closed') {
            return;
        }
        await this.#checkTransportAnswer(ctx, ref.connection);
    }
}