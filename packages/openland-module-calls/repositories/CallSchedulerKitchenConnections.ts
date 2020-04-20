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
import { MediaSources, StreamConfig } from './CallScheduler';
import { KitchenProducer } from 'openland-module-db/store';
import { writeSDP } from 'openland-module-calls/sdp/writeSDP';
import { convertIceCandidate } from 'openland-module-calls/kitchen/convert';
import { MediaDescription } from 'sdp-transform';

function isEmptySource(source: MediaSources) {
    // return !source.audioStream && !source.videoStream && !source.screenCastStream;
    return !source.audioStream;
}

function checkSources(source: MediaSources) {
    if (source.screenCastStream && source.videoStream) {
        throw Error('Two video streams are not allowed');
    }
}

function convertParameters(src: any) {
    return Object.keys(src).map((key) => `${key}=${src[key]}`).join(';');
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

    createProducerConnection = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {

        // Check sources correctness
        checkSources(sources);

        // Connection Id
        let id = uuid();

        // Create transport if sources are not empty
        let transportId: string | null = null;
        if (!isEmptySource(sources)) {
            transportId = await this.#createProducerTransport(ctx, cid, pid, sources, id);
        }

        // Create Connection
        await Store.ConferenceKitchenConnection.create(ctx, id, {
            kind: 'producer',
            localSources: sources,
            pid, cid,
            transportId,
            deleted: false
        });

        return id;
    }

    updateProducerStreams = async (ctx: Context, id: string, sources: MediaSources) => {
        checkSources(sources);

        let connection = await Store.ConferenceKitchenConnection.findById(ctx, id);
        if (!connection || connection.deleted) {
            throw Error('Unable to find connection');
        }
        if (connection.kind !== 'producer') {
            throw Error('Unable to find connection');
        }

        // Ignore if nothing changed
        if (
            sources.audioStream === connection.localSources.audioStream
            && sources.videoStream === connection.localSources.videoStream
            && sources.screenCastStream === connection.localSources.screenCastStream
        ) {
            return;
        }

        if (isEmptySource(sources) && !isEmptySource(connection.localSources)) {
            // Delete producer transport
            await this.#deleteProducerTransport(ctx, connection.transportId!);
            connection.localSources = sources;
            connection.transportId = null;
            await connection.flush(ctx);
        } else if (!isEmptySource(sources) && isEmptySource(connection.localSources)) {
            // Create producer transport
            let transportId = await this.#createProducerTransport(ctx, connection.cid, connection.pid, sources, connection.id);
            connection.localSources = sources;
            connection.transportId = transportId;
            await connection.flush(ctx);
        } else {
            // Update Connection
            await this.#restartProducerTransport(ctx, connection.transportId!, sources);
            connection.localSources = sources;
            await connection.flush(ctx);
        }
    }

    removeConnection = async (ctx: Context, id: string) => {
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, id);
        if (!connection || connection.deleted) {
            throw Error('Unable to find connection');
        }
        connection.deleted = true;
        if (connection.kind === 'producer') {
            if (!isEmptySource(connection.localSources)) {
                await this.#deleteProducerTransport(ctx, connection.transportId!);
                connection.transportId = null;
            }
        }
        await connection.flush(ctx);
    }

    //
    // Transport Managing
    //

    #createProducerTransport = async (ctx: Context, cid: number, pid: number, sources: MediaSources, connection: string) => {
        let router = (await Store.ConferenceKitchenRouter.conference.find(ctx, cid))!;
        let kitchenTransport = await this.repo.createTransport(ctx, router!.id);
        await Store.ConferenceEndStream.create(ctx, kitchenTransport, {
            pid,
            seq: 1,
            state: 'need-offer',
            localCandidates: [],
            remoteCandidates: [],
            localSdp: null,
            remoteSdp: null,
            localStreams: this.#getStreamGenericConfig(sources),
            remoteStreams: [],
            iceTransportPolicy: 'all'
        });
        await Store.ConferenceKitchenTransportRef.create(ctx, kitchenTransport, {
            connection: connection
        });
        await this.callRepo.bumpVersion(ctx, cid);
        return kitchenTransport;
    }

    #restartProducerTransport = async (ctx: Context, id: string, sources: MediaSources) => {
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
        endStream.seq++;
        endStream.state = 'need-offer';
        endStream.localSdp = null;
        endStream.remoteSdp = null;
        endStream.localStreams = this.#getStreamGenericConfig(sources);
        await this.callRepo.bumpVersion(ctx, peer.cid);
    }

    #deleteProducerTransport = async (ctx: Context, id: string) => {

        // Delete transport
        await this.repo.deleteTransport(ctx, id);

        // Delete End Stream
        let stream = (await Store.ConferenceEndStream.findById(ctx, id))!;
        stream.seq++;
        stream.state = 'completed';
        stream.remoteCandidates = [];
        stream.localCandidates = [];
        stream.localSdp = null;
        stream.remoteSdp = null;
        stream.localStreams = [];
        stream.remoteStreams = [];

        // TODO: Delete producers and consumers?
    }

    #getStreamGenericConfig = (streams: MediaSources): StreamConfig[] => {
        let res: StreamConfig[] = [];
        if (streams.videoStream) {
            res.push({ type: 'video', codec: 'h264', source: 'default' });
        }
        if (streams.screenCastStream) {
            res.push({ type: 'video', codec: 'h264', source: 'screen' });
        }
        if (streams.audioStream) {
            res.push({ type: 'audio', codec: 'opus' });
        }
        return res;
    }

    //
    // Producer Offer/Answer
    //

    #onProducerTransportOffer = async (ctx: Context, transportId: string, offer: string) => {
        let ref = await Store.ConferenceKitchenTransportRef.findById(ctx, transportId);
        if (!ref) {
            return;
        }
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, ref.connection);
        if (!connection || connection.deleted || connection.transportId !== transportId) {
            return;
        }
        if (connection.kind !== 'producer') {
            throw Error('Received unexpected offer');
        }
        let endStream = await Store.ConferenceEndStream.findById(ctx, transportId);
        if (!endStream) {
            return;
        }

        // Parsing
        let data = JSON.parse(offer);
        if (data.type !== 'offer') {
            throw Error('SDP is not offer!');
        }
        let sdp = parseSDP(data.sdp as string);

        // Transport Connect
        let fingerprints = extractFingerprints(sdp);
        await this.repo.connectTransport(ctx, transportId, fingerprints);

        // Check SDP
        let audioStreams = sdp.media.filter((v) => v.type === 'audio');
        let videoStreams = sdp.media.filter((v) => v.type === 'video');
        let remainingStreams = sdp.media.filter((v) => v.type !== 'video' && v.type !== 'audio').length;
        if (remainingStreams > 0) {
            throw Error('Found some non audio/video streams in SDP');
        }
        if (audioStreams.length > 1) {
            throw Error('Found more than one audio stream in SDP');
        }
        if (videoStreams.length > 1) {
            throw Error('Found more than one audio stream in SDP');
        }
        if (endStream.remoteStreams!.find((v) => v.type === 'audio')) {
            if (audioStreams.length === 0) {
                throw Error('Audio stream not found in SDP');
            }
        }
        if (endStream.remoteStreams!.find((v) => v.type === 'video')) {
            if (videoStreams.length === 0) {
                throw Error('Video stream not found in SDP');
            }
        }

        // Resolve Audio
        if (audioStreams.length === 1) {
            let audioMedia = audioStreams[0];
            let ssrc = audioMedia.ssrcs![0].id as number;
            const codec = audioMedia.rtp.find((v) => v.codec === 'opus');
            if (!codec) {
                throw Error('Unable to find audio codec!');
            }

            // Create Audio Producer if not exists
            if (!connection.localAudioProducer) {

                // Resolve Parameters
                // minptime and useinbandfec supported only (why?)
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
                let producerId = await this.repo.createProducer(ctx, transportId, {
                    kind: 'audio',
                    rtpParameters: {
                        codecs: [codecParameters],
                        encodings: [{ ssrc: ssrc }]
                    }
                });

                // Save producer
                await Store.ConferenceKitchenProducerRef.create(ctx, producerId, { connection: connection.id, kind: 'audio' });
                connection.localAudioProducer = producerId;
            }
        } else if (connection.localAudioProducer) {
            // Remove Producer
            await this.repo.deleteProducer(ctx, connection.localAudioProducer);
            connection.localAudioProducer = null;
        }

        // TODO: Handle Video

        // Generate answer if ready
        await connection.flush(ctx);
        await this.#checkProducerTransportAnswer(ctx, transportId);
    }

    #checkProducerTransportAnswer = async (ctx: Context, transportId: string) => {
        let ref = await Store.ConferenceKitchenTransportRef.findById(ctx, transportId);
        if (!ref) {
            return;
        }
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, ref.connection);
        if (!connection || connection.deleted || connection.transportId !== transportId) {
            return;
        }
        if (connection.kind !== 'producer') {
            throw Error('Received unexpected offer');
        }
        let endStream = await Store.ConferenceEndStream.findById(ctx, transportId);
        if (!endStream) {
            return;
        }
        if (endStream.state !== 'wait-answer') {
            return;
        }
        let transport = await Store.KitchenTransport.findById(ctx, transportId);
        if (!transport || transport.state !== 'connected') {
            return;
        }

        // Check Audio Producer
        let audioProducer: KitchenProducer | null = null;
        if (connection.localSources.audioStream) {
            if (connection.localAudioProducer) {
                let producer = await Store.KitchenProducer.findById(ctx, connection.localAudioProducer);
                if (!producer) {
                    return;
                }
                if (producer.state === 'created') {
                    audioProducer = producer;
                } else {
                    return;
                }
            } else {
                return;
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
                payloads: audioProducer!.rtpParameters!.codecs[0].payloadType.toString(),
                port: 7,
                rtcpMux: 'rtcp-mux',
                rtcpRsize: 'rtcp-rsize',
                direction: 'recvonly',

                // Codec
                rtp: [{
                    payload: audioProducer!.rtpParameters!.codecs[0].payloadType,
                    rate: audioProducer!.rtpParameters!.codecs[0].clockRate,
                    encoding: 2,
                    codec: 'opus',
                }],
                fmtp: [{
                    payload: audioProducer!.rtpParameters!.codecs[0].payloadType,
                    config: convertParameters(audioProducer!.rtpParameters!.codecs[0].parameters || {})
                }],
                rtcpFb: audioProducer!.rtpParameters!.codecs[0].rtcpFeedback!.map((v) => ({
                    payload: audioProducer!!.rtpParameters!.codecs[0].payloadType,
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
        await this.callRepo.bumpVersion(ctx, connection.cid);
    }

    //
    // Callbacks
    //

    onWebRTCConnectionOffer = async (ctx: Context, transportId: string, offer: string) => {

        //
        // Route offer from web to kitchen producer transport
        //

        let ref = await Store.ConferenceKitchenTransportRef.findById(ctx, transportId);
        if (!ref) {
            return;
        }
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, ref.connection);
        if (!connection || connection.deleted) {
            return;
        }
        if (connection.kind !== 'producer') {
            throw Error('Received unexpected offer');
        }
        await this.#onProducerTransportOffer(ctx, transportId, offer);
    }

    onWebRTCConnectionAnswer = async (ctx: Context, transportId: string, answer: string) => {
        //
    }

    onKitchenTransportCreated = async (ctx: Context, transportId: string) => {

        //
        // Check if producer transport should send answer
        //

        await this.#checkProducerTransportAnswer(ctx, transportId);
    }

    onKitchenProducerCreated = async (ctx: Context, producerId: string) => {

        //
        // Check if producer transport should send answer
        //

        let ref = await Store.ConferenceKitchenProducerRef.findById(ctx, producerId);
        if (!ref) {
            return;
        }
        let connection = await Store.ConferenceKitchenConnection.findById(ctx, ref.connection);
        if (!connection || connection.deleted) {
            return;
        }
        if (connection.kind !== 'producer') {
            throw Error('Received unexpected offer');
        }
        await this.#checkProducerTransportAnswer(ctx, connection.transportId!);
    }

    onKitchenConsumerCreated = async (ctx: Context, consumerId: string) => {
        // TODO: Implement
    }
}