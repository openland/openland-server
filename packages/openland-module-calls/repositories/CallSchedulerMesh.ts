import { Store } from 'openland-module-db/FDB';
import { createLogger } from '@openland/log';
import { Context } from '@openland/context';
import { CallScheduler, StreamConfig, MediaSources } from './CallScheduler';
import uuid from 'uuid/v4';
import { ConferenceMeshLink } from 'openland-module-db/store';

const logger = createLogger('calls-mesh');
type LinkKind = 'generic' | 'screencast';
const KIND_GENERIC: LinkKind = 'generic';
const KIND_SCREENCAST: LinkKind = 'screencast';

function hasGenericSources(source: MediaSources) {
    return source.audioStream || source.videoStream;
}

export class CallSchedulerMesh implements CallScheduler {
    private iceTransportPolicy: 'all' | 'relay';

    constructor(iceTransportPolicy: 'all' | 'relay') {
        this.iceTransportPolicy = iceTransportPolicy;
    }

    //
    // Conference State
    //

    onConferenceStarted = async (ctx: Context, cid: number) => {
        logger.log(ctx, 'Conference started: ' + cid);
    }

    onConferenceStopped = async (ctx: Context, cid: number) => {
        logger.log(ctx, 'Conference stopped: ' + cid);
    }

    //
    // Peer States
    //

    onPeerAdded = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {
        logger.log(ctx, 'Peer added: ' + pid + ', ' + JSON.stringify(sources));

        // Find existing peers
        let existingPeers = await Store.ConferenceMeshPeer.conference.findAll(ctx, cid);

        // Create Peer
        await Store.ConferenceMeshPeer.create(ctx, cid, pid, {
            sources,
            active: true
        });

        for (let ex of existingPeers) {
            // Create Generic Links
            if (hasGenericSources(sources) || hasGenericSources(ex.sources)) {
                await this.#createGenericLink(ctx, cid, ex.pid, pid, ex.sources, sources);
            }
            // Create Screencast Links
            if (sources.screenCastStream) {
                await this.#createScreencastLink(ctx, cid, pid, ex.pid, sources);
            }
            if (ex.sources.screenCastStream) {
                await this.#createScreencastLink(ctx, cid, ex.pid, pid, ex.sources);
            }

        }
    }

    onPeerStreamsChanged = async (ctx: Context, cid: number, pid: number, sources: MediaSources) => {
        logger.log(ctx, 'Peer streems changed: ' + pid + ', ' + JSON.stringify(sources));
        let peer = await Store.ConferenceMeshPeer.findById(ctx, cid, pid);
        if (!peer || !peer.active) {
            // throw Error('Unable to find peer!');
            return;
        }
        let prevSources = peer.sources;
        peer.sources = sources;
        await peer.flush(ctx);

        //
        // Update Generic Links
        //

        if (
            prevSources.videoStream !== sources.videoStream ||
            prevSources.audioStream !== sources.audioStream
        ) {
            let existingPeers = await Store.ConferenceMeshPeer.conference.findAll(ctx, cid);
            for (let e of existingPeers) {
                if (e.pid === pid) {
                    continue;
                }
                if (hasGenericSources(e.sources)) {
                    // Other peer has sources - update existing link
                    await this.#updateGenericLink(ctx, cid, e.pid, pid, e.sources, sources);
                } else if (hasGenericSources(prevSources) && hasGenericSources(sources)) {
                    // Current peer had and has sources - update existing link
                    await this.#updateGenericLink(ctx, cid, e.pid, pid, e.sources, sources);
                } else if (hasGenericSources(prevSources) && !hasGenericSources(sources)) {
                    // Current peer lost sources and other peer doesnt have any sources: remove link
                    await this.#removeGenericLink(ctx, cid, e.pid, pid);
                } else if (!hasGenericSources(prevSources) && hasGenericSources(sources)) {
                    // Current peer got new sources and other peer doesnt have any sources: add link
                    await this.#createGenericLink(ctx, cid, e.pid, pid, e.sources, sources);
                } else {
                    // Both peers doesn't have streams: ignore
                }
            }
        }

        if (
            prevSources.screenCastStream !== sources.screenCastStream
        ) {
            let existingPeers = await Store.ConferenceMeshPeer.conference.findAll(ctx, cid);
            for (let e of existingPeers) {
                if (e.pid === pid) {
                    continue;
                }
                if (sources.screenCastStream) {
                    await this.#createScreencastLink(ctx, cid, pid, e.pid, sources);
                } else {
                    await this.#removeScreenCastLink(ctx, cid, pid, e.pid);
                }
            }
        }
    }

    onPeerRemoved = async (ctx: Context, cid: number, pid: number) => {
        logger.log(ctx, 'Peer removed: ' + pid);
        let peer = await Store.ConferenceMeshPeer.findById(ctx, cid, pid);
        if (!peer || !peer.active) {
            // throw Error('Unable to find peer!');
            return;
        }
        peer.active = false;
        await peer.flush(ctx);

        // Find existing peers
        let existingPeers = await Store.ConferenceMeshPeer.conference.findAll(ctx, cid);

        for (let e of existingPeers) {
            // Remove generic links
            if (e.pid === pid) {
                continue;
            }
            if (hasGenericSources(e.sources) || hasGenericSources(peer.sources)) {
                await this.#removeGenericLink(ctx, cid, e.pid, pid);
            }
            // Remove screencast links
            if (e.sources.screenCastStream) {
                await this.#removeScreenCastLink(ctx, cid, e.pid, pid);
            }
            if (peer.sources.screenCastStream) {
                await this.#removeScreenCastLink(ctx, cid, pid, e.pid);
            }
        }

    }

    //
    // Generic Link
    //

    #createGenericLink = async (ctx: Context,
        cid: number, pid1: number, pid2: number,
        sources1: MediaSources, sources2: MediaSources
    ) => {
        let streamId1 = uuid();
        let stream1Config = this.#getStreamGenericConfig(sources1);
        let streamId2 = uuid();
        let stream2Config = this.#getStreamGenericConfig(sources2);

        // Create First Stream
        await Store.ConferenceEndStream.create(ctx, streamId1, {
            pid: pid1,
            seq: 1,
            state: 'need-offer',

            localSdp: null,
            localStreams: stream1Config,
            localCandidates: [],

            remoteSdp: null,
            remoteStreams: this.#assignConfigPeer(stream2Config, pid2),
            remoteCandidates: [],

            iceTransportPolicy: this.iceTransportPolicy
        });

        // Create Second Stream
        await Store.ConferenceEndStream.create(ctx, streamId2, {
            pid: pid2,
            seq: 1,
            state: 'wait-offer',

            localSdp: null,
            localStreams: stream2Config,
            localCandidates: [],

            remoteSdp: null,
            remoteStreams: stream1Config.map((v) => ({
                pid: pid1,
                media: v
            })),
            remoteCandidates: [],

            iceTransportPolicy: this.iceTransportPolicy
        });

        // Create Link
        let existingLink = await Store.ConferenceMeshLink.active.find(ctx, cid, Math.min(pid1, pid2), Math.max(pid1, pid2), KIND_GENERIC);
        if (existingLink) {
            throw Error('Scheduler error');
        }
        if (pid1 < pid2) {
            let id = uuid();
            await Store.ConferenceMeshLink.create(ctx, id, {
                cid,
                pid1,
                pid2,
                leader: pid1,
                esid1: streamId1,
                esid2: streamId2,
                state: 'wait-offer',
                kind: KIND_GENERIC
            });
            logger.log(ctx, 'Link ' + id + ' created');
        } else {
            let id = uuid();
            await Store.ConferenceMeshLink.create(ctx, id, {
                cid,
                pid1: pid2,
                pid2: pid1,
                leader: pid2,
                esid1: streamId2,
                esid2: streamId1,
                state: 'wait-offer',
                kind: KIND_GENERIC
            });
            logger.log(ctx, 'Link ' + id + ' created');
        }
    }

    #updateGenericLink = async (ctx: Context,
        cid: number,
        pid1: number,
        pid2: number,
        sources1: MediaSources,
        sources2: MediaSources
    ) => {
        let link = await Store.ConferenceMeshLink.active.find(ctx, cid, Math.min(pid1, pid2), Math.max(pid1, pid2), KIND_GENERIC);
        if (!link || link.state === 'completed') {
            return;
        }
        link.state = 'wait-offer';

        let stream1 = (await Store.ConferenceEndStream.findById(ctx, link.esid1))!;
        let stream2 = (await Store.ConferenceEndStream.findById(ctx, link.esid2))!;

        // Reset negotiation
        stream1.seq++;
        stream2.seq++;
        stream2.localSdp = null;
        stream2.remoteSdp = null;
        stream1.localSdp = null;
        stream1.remoteSdp = null;
        if (link.leader === pid1) {
            if (link.pid1 === pid1) {
                stream1.state = 'need-offer';
                stream2.state = 'wait-offer';
            } else {
                stream2.state = 'need-offer';
                stream1.state = 'wait-offer';
            }
        } else {
            if (link.pid1 === pid1) {
                stream2.state = 'need-offer';
                stream1.state = 'wait-offer';
            } else {
                stream1.state = 'need-offer';
                stream2.state = 'wait-offer';
            }
        }

        // Update streams
        if (link.pid1 === pid1) {
            stream1.localStreams = this.#getStreamGenericConfig(sources1);
            stream1.remoteStreams = this.#assignConfigPeer(this.#getStreamGenericConfig(sources2), pid2);
            stream2.localStreams = this.#getStreamGenericConfig(sources2);
            stream2.remoteStreams = this.#assignConfigPeer(this.#getStreamGenericConfig(sources1), pid1);
        } else {
            stream2.localStreams = this.#getStreamGenericConfig(sources1);
            stream2.remoteStreams = this.#assignConfigPeer(this.#getStreamGenericConfig(sources2), pid1);
            stream1.localStreams = this.#getStreamGenericConfig(sources2);
            stream1.remoteStreams = this.#assignConfigPeer(this.#getStreamGenericConfig(sources1), pid2);
        }
    }

    #removeGenericLink = async (ctx: Context, cid: number, _pid1: number, _pid2: number) => {
        let link = await Store.ConferenceMeshLink.active.find(ctx, cid, Math.min(_pid1, _pid2), Math.max(_pid1, _pid2), KIND_GENERIC);
        if (!link || link.state === 'completed') {
            return;
        }
        await this.#cleanUpLink(ctx, link);
    }

    #getStreamGenericConfig = (streams: MediaSources): StreamConfig[] => {
        let res: StreamConfig[] = [];
        if (streams.videoStream) {
            res.push({ type: 'video', codec: 'h264', source: 'default' });
        }
        if (streams.audioStream) {
            res.push({ type: 'audio', codec: 'opus' });
        }
        res.push({ type: 'dataChannel', ordered: true, id: 0, label: 'bus' });
        return res;
    }
    #assignConfigPeer = (media: StreamConfig[], pid: number) => {
        return media.map((v) => ({
            pid,
            media: v
        }));
    }

    //
    // Screencast link
    //

    #createScreencastLink = async (ctx: Context,
        cid: number, producerPid: number, consumerPid: number,
        sources: MediaSources
    ) => {
        let streamProducerId = uuid();
        let streamProducerConfig = this.#getStreamScreenCastConfig(sources);
        let streamConsumerId = uuid();

        // Create First Stream
        await Store.ConferenceEndStream.create(ctx, streamProducerId, {
            pid: producerPid,
            seq: 1,
            state: 'need-offer',

            localSdp: null,
            localStreams: streamProducerConfig,
            localCandidates: [],

            remoteSdp: null,
            remoteStreams: [],
            remoteCandidates: [],

            iceTransportPolicy: this.iceTransportPolicy
        });

        // Create Second Stream
        await Store.ConferenceEndStream.create(ctx, streamConsumerId, {
            pid: consumerPid,
            seq: 1,
            state: 'wait-offer',

            localSdp: null,
            localStreams: [],
            localCandidates: [],

            remoteSdp: null,
            remoteStreams: this.#assignConfigPeer(streamProducerConfig, producerPid),
            remoteCandidates: [],

            iceTransportPolicy: this.iceTransportPolicy
        });

        // Create Link
        let existingLink = await Store.ConferenceMeshLink.active.find(ctx, cid, producerPid, consumerPid, KIND_SCREENCAST);
        if (existingLink) {
            throw Error('Scheduler error');
        }
        let id = uuid();
        await Store.ConferenceMeshLink.create(ctx, id, {
            cid,
            pid1: producerPid,
            pid2: consumerPid,
            leader: producerPid,
            esid1: streamProducerId,
            esid2: streamConsumerId,
            state: 'wait-offer',
            kind: KIND_SCREENCAST
        });
        logger.log(ctx, 'Link ' + id + ' created');
    }

    #removeScreenCastLink = async (ctx: Context, cid: number, producerPid: number, consumerPid: number) => {
        let link = await Store.ConferenceMeshLink.active.find(ctx, cid, producerPid, consumerPid, KIND_SCREENCAST);
        if (!link || link.state === 'completed') {
            return;
        }
        await this.#cleanUpLink(ctx, link);
    }

    #cleanUpLink = async (ctx: Context, link: ConferenceMeshLink) => {
        link.state = 'completed';

        // Stop streams
        let stream1 = (await Store.ConferenceEndStream.findById(ctx, link.esid1))!;
        let stream2 = (await Store.ConferenceEndStream.findById(ctx, link.esid2))!;
        stream1.state = 'completed';
        stream1.remoteCandidates = [];
        stream1.localCandidates = [];
        stream1.localSdp = null;
        stream1.remoteSdp = null;
        stream1.localStreams = [];
        stream1.remoteStreams = [];
        stream2.state = 'completed';
        stream2.remoteCandidates = [];
        stream2.localCandidates = [];
        stream2.localSdp = null;
        stream2.remoteSdp = null;
        stream2.localStreams = [];
        stream2.remoteStreams = [];
    }

    #getStreamScreenCastConfig = (streams: MediaSources): StreamConfig[] => {
        return [{ type: 'video', codec: 'h264', source: 'screen' }];
    }

    //
    // Streams
    //

    onStreamCandidate = async (ctx: Context, cid: number, pid: number, sid: string, candidate: string) => {
        // logger.log(ctx, 'Candidate: ' + pid + ', ' + candidate);

        let link = (await Store.ConferenceMeshLink.conference.findAll(ctx, cid))
            .find((v) => v.esid1 === sid || v.esid2 === sid);
        if (!link || link.state === 'completed') {
            return;
        }

        let otherStreamId = link.esid1 === sid ? link.esid2 : link.esid1;
        let otherStream = await Store.ConferenceEndStream.findById(ctx, otherStreamId);
        if (!otherStream || otherStream.state === 'completed') {
            return;
        }

        otherStream.remoteCandidates = [...otherStream.remoteCandidates, candidate];
    }

    onStreamOffer = async (ctx: Context, cid: number, pid: number, sid: string, offer: string) => {
        logger.log(ctx, 'Offer: ' + pid + ', ' + offer);

        let link = (await Store.ConferenceMeshLink.conference.findAll(ctx, cid))
            .find((v) => v.esid1 === sid || v.esid2 === sid);
        if (!link || link.state !== 'wait-offer') {
            logger.log(ctx, 'exit1');
            return;
        }
        let otherStreamId = link.esid1 === sid ? link.esid2 : link.esid1;
        let otherStream = await Store.ConferenceEndStream.findById(ctx, otherStreamId);
        if (!otherStream || otherStream.state === 'completed') {
            logger.log(ctx, 'exit2');
            return;
        }

        link.state = 'wait-answer';
        // still need to increment for back compatibility
        otherStream.seq++;
        otherStream.remoteSdp = offer;
        otherStream.state = 'need-answer';
    }

    onStreamAnswer = async (ctx: Context, cid: number, pid: number, sid: string, answer: string) => {
        logger.log(ctx, 'Answer: ' + pid + ', ' + answer);

        let link = (await Store.ConferenceMeshLink.conference.findAll(ctx, cid))
            .find((v) => v.esid1 === sid || v.esid2 === sid);
        if (!link || link.state !== 'wait-answer') {
            logger.log(ctx, 'exit1');
            return;
        }

        // move current stream to READY state
        let stream = await Store.ConferenceEndStream.findById(ctx, sid);
        if (stream) {
            stream.seq++;
            stream.state = 'online';
        }

        let otherStreamId = link.esid1 === sid ? link.esid2 : link.esid1;
        let otherStream = await Store.ConferenceEndStream.findById(ctx, otherStreamId);
        if (!otherStream || otherStream.state === 'completed') {
            logger.log(ctx, 'exit2');
            return;
        }

        link.state = 'online';
        // still need to increment for back compatibility
        otherStream.seq++;
        otherStream.remoteSdp = answer;
        otherStream.state = 'online';
    }
}