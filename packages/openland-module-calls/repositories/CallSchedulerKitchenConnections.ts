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
import { MediaSources, StreamHint, ProducerDescriptor, ConsumerDescriptor } from './CallScheduler';
import { KitchenProducer } from 'openland-module-db/store';
import { writeSDP } from 'openland-module-calls/sdp/writeSDP';
import { convertIceCandidate } from 'openland-module-calls/kitchen/convert';
import { MediaDescription } from 'sdp-transform';
import { RtpParameters } from 'mediakitchen';

const logger = createLogger('calls-kitchen');

function convertParameters(src: any) {
    return Object.keys(src).map((key) => `${key}=${src[key]}`).join(';');
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

        // Conference Router
        let router = (await Store.ConferenceKitchenRouter.conference.find(ctx, cid))!;

        // Connection transport
        await this.repo.createTransport(ctx, id, router.id);

        // Producers/Consumers
        let initialProducers = this.#getProducerDescriptors(produces);
        let initialConsumers = await this.#getConsumerDescriptors(ctx, consumes);

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
            remoteStreams: initialConsumers,
            iceTransportPolicy: 'none'
        });

        // this.repo.createConsumer(ctx, id,)

        // Create Connection
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
            consumers: initialConsumers.map((v) => ({
                mid: null,
                connection: v.connection,
                kind: v.media.type === 'audio' ? 'audio' : (v.media.source === 'default' ? 'video' : 'screencast'),
                consumer: ''
            }))
        });

        // Bump
        await this.callRepo.bumpVersion(ctx, cid, pid);

        return id;
    }

    updateConsumes = async (ctx: Context, id: string, connections: string[]) => {
        // TODO: Implementg
    }

    updateProduces = async (ctx: Context, id: string, sources: MediaSources) => {
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, id);
        if (!connection || connection.deleted) {
            throw Error('Unable to find connection');
        }

        // Ignore if nothing changed
        if (
            sources.audioStream === connection.produces.audioStream
            && sources.videoStream === connection.produces.videoStream
            && sources.screenCastStream === connection.produces.screenCastStream
        ) {
            return;
        }

        // Update Connection
        connection.producerSources = sources;
        await this.#restartTransport(ctx, connection.transportId!, sources);
        await connection.flush(ctx);
    }

    removeConnection = async (ctx: Context, id: string) => {
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, id);
        if (!connection || connection.deleted) {
            throw Error('Unable to find connection');
        }
        connection.deleted = true;
        await this.#deleteTransport(ctx, connection.transportId);
        await connection.flush(ctx);
    }

    //
    // Transport Managing
    //

    // #getRemoteStreams = async (ctx: Context, sources: string[]) => {
    //     let res: ({ connection: string, kind: 'audio' | 'video' })[] = [];
    //     let producers: string[] = [];
    //     let connections = await Promise.all(sources.map((id) => Store.ConferenceKitchenConnection.findById(ctx, id)));
    //     for (let c of connections) {
    //         if (c === null) {
    //             throw Error('Invalid connection');
    //         }
    //         if (c.localSources.audioStream) {
    //             if (c.localAudioProducer) {
    //                 res.push({ connection: c.id, kind: 'audio' });
    //                 producers.push(c.localAudioProducer);
    //             }
    //         }
    //         if (c.localSources.videoStream) {
    //             if (c.localVideoProducer) {
    //                 res.push({ connection: c.id, kind: 'video' });
    //                 producers.push(c.localVideoProducer);
    //             }
    //         }
    //         if (c.localSources.screenCastStream) {
    //             if (c.localVideoProducer) {
    //                 res.push({ connection: c.id, kind: 'video' });
    //                 producers.push(c.localVideoProducer);
    //             }
    //         }
    //     }
    //     return {
    //         streams: res,
    //         producers: producers
    //     };
    // }

    // #enumerateStreams = (ctx: Context, streams: ({ connection: string, kind: 'audio' | 'video' })[]) => {
    //     return streams.map((v, i) => ({
    //         mid: i,
    //         connection: v.connection,
    //         kind: v.kind
    //     }));
    // }

    #restartTransport = async (ctx: Context, id: string, sources: MediaSources) => {
        let endStream = await Store.ConferenceEndStream.findById(ctx, id);
        if (!endStream) {
            throw Error('Unable to find stream');
        }
        let peer = await Store.ConferencePeer.findById(ctx, endStream.pid);
        if (!peer) {
            throw Error('Unable to find peer');
        }
        if (endStream.state === 'completed') {
            return;
        }
        let ref = await Store.ConferenceKitchenTransportRef.findById(ctx, id);
        if (!ref) {
            return;
        }
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, ref.connection);
        if (!connection) {
            return;
        }
        let transport = await Store.ConferenceKitchenTransport.findById(ctx, id);
        if (!transport || transport.deleted) {
            return;
        }

        endStream.seq++;
        endStream.state = 'need-offer';
        endStream.localSdp = null;
        endStream.remoteSdp = null;
        endStream.localStreams = this.#getStreamConfigs(sources);
        endStream.remoteStreams = [];

        await this.callRepo.bumpVersion(ctx, peer.cid, peer.id);

        logger.log(ctx, 'Transport ' + id + ' restarted');
    }

    #deleteTransport = async (ctx: Context, id: string) => {

        let ref = await Store.ConferenceKitchenTransportRef.findById(ctx, id);
        if (!ref) {
            return;
        }
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, ref.id);
        if (!connection) {
            return;
        }
        let stream = (await Store.ConferenceEndStream.findById(ctx, id));
        if (!stream) {
            return;
        }
        if (stream.state === 'completed') {
            return;
        }
        let producerTransport = await Store.ConferenceKitchenTransport.findById(ctx, id);
        if (!producerTransport || producerTransport.deleted) {
            return;
        }

        // Delete transport
        await this.repo.deleteTransport(ctx, id);

        // Delete End Stream
        stream.seq++;
        stream.state = 'completed';
        stream.remoteCandidates = [];
        stream.localCandidates = [];
        stream.localSdp = null;
        stream.remoteSdp = null;
        stream.localStreams = [];
        stream.remoteStreams = [];

        // Delete producers
        if (producerTransport.audioProducer) {
            await this.repo.deleteProducer(ctx, producerTransport.audioProducer);
            producerTransport.audioProducer = null;
        }
        if (producerTransport.videoProducer) {
            await this.repo.deleteProducer(ctx, producerTransport.videoProducer);
            producerTransport.videoProducer = null;
        }
        if (producerTransport.screencastProducer) {
            await this.repo.deleteProducer(ctx, producerTransport.screencastProducer);
            producerTransport.screencastProducer = null;
        }

        // TODO: Delete consumers

        // Delete tranport
        producerTransport.deleted = true;

        logger.log(ctx, 'Transport ' + id + ' stopped');
    }

    #getConsumerDescriptors = async (ctx: Context, consumers: string[]) => {
        let res: ConsumerDescriptor[] = [];
        for (let c of consumers) {
            let connection = await Store.ConferenceKitchenConnection.findById(ctx, c);
            if (!connection) {
                continue;
            }
            if (connection.state === 'closed') {
                continue;
            }
            if (connection.videoProducer) {
                let producer = await this.#getActiveProducer(ctx, connection.videoProducer);
                if (producer) {
                    res.push({
                        pid: connection.pid,
                        media: producer.parameters.kind === 'audio' ? {
                            type: 'audio',
                            mid: null
                        } : {
                                type: 'video',
                                source: 'default',
                                mid: null
                            }
                    });
                }
            }
        }
        return res;
    }

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

    //
    // Producer Offer/Answer
    //

    #onTransportOffer = async (ctx: Context, transportId: string, offer: string, hints: StreamHint[]) => {
        let ref = await Store.ConferenceKitchenTransportRef.findById(ctx, transportId);
        if (!ref) {
            return;
        }
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, ref.connection);
        if (!connection || connection.transportState !== 'negotiation' || connection.transportId !== transportId) {
            return;
        }
        let endStream = await Store.ConferenceEndStream.findById(ctx, transportId);
        if (!endStream) {
            return;
        }
        let producerTransport = await Store.ConferenceTra.findById(ctx, transportId);
        if (!producerTransport || producerTransport.deleted) {
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
            await this.repo.connectTransport(ctx, transportId, fingerprints);
        } else {
            return;
        }

        // Create producers if needed
        for (let h of hints) {
            let media = sdp.media.find((v) => v.mid === h.mid);

            // Check if hits are compatible
            if (!media) {
                throw Error('Inconsistent hints');
            }

            // Check if direction valid
            if (media.direction !== 'sendonly' && media.direction !== 'inactive') {
                throw Error('Incompatible hints');
            }

            if (h.kind === 'audio') {
                if (producerTransport.audioProducer) {
                    if (media.direction === 'inactive') {
                        // TODO: Pause
                    } else {
                        // TODO: Unpause
                    }
                } else if (media.direction === 'sendonly') {

                    // Create opus producer
                    let rtpParameters = getOpusRtpParameters(media);
                    let producerId = await this.repo.createProducer(ctx, transportId, { kind: 'audio', rtpParameters });
                    await Store.ConferenceKitchenProducerRef.create(ctx, producerId, { connection: connection.id });
                } else if (media.direction === 'inactive') {
                    // Do nothing since producer is not created and it is inactive anyway
                }
            } else if (h.kind === 'video') {
                if (h.videoSource === 'default') {
                    //
                } else if (h.videoSource === 'screen') {
                    //
                } else {
                    throw Error('Unknown video source: ' + h.videoSource);
                }
            } else {
                throw Error('Unknown kind: ' + h.kind);
            }
        }

        // Check SDP
        // let audioStreams = sdp.media.filter((v) => v.type === 'audio');
        // let videoStreams = sdp.media.filter((v) => v.type === 'video');
        // let remainingStreams = sdp.media.filter((v) => v.type !== 'video' && v.type !== 'audio').length;
        // if (remainingStreams > 0) {
        //     throw Error('Found some non audio/video streams in SDP');
        // }
        // if (audioStreams.length > 1) {
        //     throw Error('Found more than one audio stream in SDP');
        // }
        // if (videoStreams.length > 1) {
        //     throw Error('Found more than one audio stream in SDP');
        // }
        // if (endStream.localStreams!.find((v) => v.type === 'audio')) {
        //     if (audioStreams.length === 0) {
        //         throw Error('Audio stream not found in SDP');
        //     }
        // }
        // if (!endStream.localStreams!.find((v) => v.type === 'audio')) {
        //     if (audioStreams.length !== 0) {
        //         throw Error('Audio stream present in SDP');
        //     }
        // }
        // if (endStream.localStreams!.find((v) => v.type === 'video')) {
        //     if (videoStreams.length === 0) {
        //         throw Error('Video stream not found in SDP');
        //     }
        // }
        // if (!endStream.localStreams!.find((v) => v.type === 'video')) {
        //     if (videoStreams.length !== 0) {
        //         throw Error('Video stream present in SDP');
        //     }
        // }

        // // Resolve Audio
        // if (audioStreams.length === 1) {
        //     let audioMedia = audioStreams[0];
        //     let ssrc = audioMedia.ssrcs![0].id as number;
        //     const codec = audioMedia.rtp.find((v) => v.codec === 'opus');
        //     if (!codec) {
        //         throw Error('Unable to find audio codec!');
        //     }

        //     // Create Audio Producer if not exists
        //     if (!producerTransport.localAudioProducer) {

        //         // Resolve Parameters
        //         let params: any = {};
        //         let fmt = audioMedia.fmtp.find((v) => v.payload === codec.payload);
        //         if (fmt) {
        //             params = decodeParameters(fmt.config);
        //         }

        //         // Create Producer
        //         let codecParameters = {
        //             mimeType: 'audio/opus',
        //             payloadType: codec.payload,
        //             clockRate: 48000,
        //             channels: 2,
        //             parameters: params,
        //             rtcpFeedback: [{
        //                 type: 'transport-cc'
        //             }]
        //         };
        //         let producerId = await this.repo.createProducer(ctx, transportId, {
        //             kind: 'audio',
        //             rtpParameters: {
        //                 codecs: [codecParameters],
        //                 encodings: [{ ssrc: ssrc }]
        //             }
        //         });

        //         // Save producer
        //         await Store.ConferenceKitchenProducerRef.create(ctx, producerId, { connection: connection.id, kind: 'audio' });
        //         producerTransport.localAudioProducer = producerId;
        //     }
        // }

        // // Handle Video
        // if (videoStreams.length === 1) {
        //     let videoMedia = videoStreams[0];
        //     let ssrc = videoMedia.ssrcs![0].id as number;

        //     // Resolving a codec
        //     let codecPayload: number | null = null;
        //     for (let c of videoMedia.rtp) {
        //         if (c.codec !== 'H264') {
        //             continue;
        //         }
        //         let fmt = videoMedia.fmtp.find((f) => f.payload === c.payload);
        //         if (!fmt) {
        //             continue;
        //         }
        //         let cfg = decodeParameters(fmt.config);
        //         if (cfg['packetization-mode'] !== '1') {
        //             continue;
        //         }
        //         if (cfg['profile-level-id'] !== '42e034' && cfg['profile-level-id'] !== '42e01f') {
        //             continue;
        //         }
        //         codecPayload = c.payload;
        //         break;
        //     }
        //     if (codecPayload === null) {
        //         throw Error('Unable to find vide codec');
        //     }
        //     let codec = videoMedia.rtp.find((v) => v.payload === codecPayload)!;

        //     // Create Video Producer if possible
        //     if (!producerTransport.localVideoProducer) {

        //         // Resolve Param
        //         let params: any = {};
        //         let fmt = videoMedia.fmtp.find((v) => v.payload === codec.payload);
        //         if (fmt) {
        //             params = decodeParameters(fmt.config);
        //         }
        //         params['profile-level-id'] = '42e01f';
        //         params['packetization-mode'] = 1;
        //         params['level-asymmetry-allowed'] = 1;

        //         // Create Producer
        //         let codecParameters = {
        //             mimeType: 'video/H264',
        //             payloadType: codec.payload,
        //             clockRate: 90000,
        //             parameters: params,
        //             rtcpFeedback: [{
        //                 type: 'transport-cc'
        //             }]
        //         };
        //         let producerId = await this.repo.createProducer(ctx, transportId, {
        //             kind: 'video',
        //             rtpParameters: {
        //                 codecs: [codecParameters],
        //                 encodings: [{ ssrc: ssrc }]
        //             }
        //         });

        //         // Save producer
        //         await Store.ConferenceKitchenProducerRef.create(ctx, producerId, { connection: connection.id, kind: 'video' });
        //         producerTransport.localVideoProducer = producerId;
        //     }
        // }

        // Generate answer if ready
        await connection.flush(ctx);
        await this.#checkTransportAnswer(ctx, transportId);
    }

    #checkTransportAnswer = async (ctx: Context, id: string) => {
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
        if (connection.produces!.audioStream) {
            if (connection.audioProducer) {
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
        if (connection.produces!.videoStream) {
            if (connection.videoProducer) {
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
        if (connection.produces!.screenCastStream) {
            if (connection.screencastProducer) {
                let producer = await this.#getActiveProducer(ctx, connection.screencastProducer);
                if (!producer) {
                    return; // Not created yet
                }
                screencastProducer = producer;
            } else {
                return; // Should not happen
            }
        }

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

        if (audioProducer) {
            media.push({
                mid: '0',
                type: 'audio',
                protocol: 'UDP/TLS/RTP/SAVPF',
                payloads: audioProducer.rtpParameters!.codecs[0].payloadType.toString(),
                port: 7,
                rtcpMux: 'rtcp-mux',
                rtcpRsize: 'rtcp-rsize',
                direction: 'recvonly',

                // Codec
                rtp: [{
                    payload: audioProducer.rtpParameters!.codecs[0].payloadType,
                    rate: audioProducer.rtpParameters!.codecs[0].clockRate,
                    encoding: 2,
                    codec: 'opus',
                }],
                fmtp: [{
                    payload: audioProducer.rtpParameters!.codecs[0].payloadType,
                    config: convertParameters(audioProducer.rtpParameters!.codecs[0].parameters || {})
                }],
                rtcpFb: audioProducer.rtpParameters!.codecs[0].rtcpFeedback!.map((v) => ({
                    payload: audioProducer!.rtpParameters!.codecs[0].payloadType,
                    type: v.type,
                    subtype: v.parameter ? v.parameter : undefined
                })),

                // ICE + DTLS
                setup: 'active',
                connection: { ip: '0.0.0.0', version: 4 },
                candidates: iceCandidates.map((v) => convertIceCandidate(v)),
                endOfCandidates: 'end-of-candidates',
                ...{ iceOptions: 'renomination' },
            });
        }

        if (videoProducer) {
            media.push({
                mid: '1',
                type: 'video',
                protocol: 'UDP/TLS/RTP/SAVPF',
                payloads: videoProducer.rtpParameters!.codecs[0].payloadType.toString(),
                port: 8,
                rtcpMux: 'rtcp-mux',
                rtcpRsize: 'rtcp-rsize',
                direction: 'recvonly',

                // Codec
                rtp: [{
                    payload: videoProducer.rtpParameters!.codecs[0].payloadType,
                    rate: videoProducer.rtpParameters!.codecs[0].clockRate,
                    codec: 'H264',
                }],
                fmtp: [{
                    payload: videoProducer.rtpParameters!.codecs[0].payloadType,
                    config: convertParameters({ ...videoProducer.rtpParameters!.codecs[0].parameters })
                }],
                rtcpFb: videoProducer.rtpParameters!.codecs[0].rtcpFeedback!.map((v) => ({
                    payload: videoProducer!.rtpParameters!.codecs[0].payloadType,
                    type: v.type,
                    subtype: v.parameter ? v.parameter : undefined
                })),

                // ICE + DTLS
                setup: 'active',
                connection: { ip: '0.0.0.0', version: 4 },
                candidates: iceCandidates.map((v) => convertIceCandidate(v)),
                endOfCandidates: 'end-of-candidates',
                ...{ iceOptions: 'renomination' },
            });
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