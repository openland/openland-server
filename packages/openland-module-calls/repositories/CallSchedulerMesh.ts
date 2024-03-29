import { Store } from 'openland-module-db/FDB';
import { createLogger } from '@openland/log';
import { Context } from '@openland/context';
import { CallScheduler, MediaSources, StreamHint, ProducerDescriptor, Capabilities } from './CallScheduler';
import uuid from 'uuid/v4';
import { ConferenceMeshLink } from 'openland-module-db/store';
import { parseSDP } from 'openland-module-calls/sdp/parseSDP';
import { CallRepository } from './CallRepository';
import { EndStreamDirectory } from './EndStreamDirectory';

const logger = createLogger('calls-mesh');
type LinkKind = 'generic' | 'screencast';
const KIND_GENERIC: LinkKind = 'generic';
const KIND_SCREENCAST: LinkKind = 'screencast';

function hasGenericSources(source: MediaSources) {
    return source.audioStream || source.videoStream;
}

export class CallSchedulerMesh implements CallScheduler {
    private iceTransportPolicy: 'all' | 'relay' | 'none';
    private repo: CallRepository;

    readonly endStreamDirectory = new EndStreamDirectory(Store.EndStreamDirectory);

    // Candidates are ignored
    supportsCandidates = true;

    constructor(iceTransportPolicy: 'all' | 'relay' | 'none', repo: CallRepository) {
        this.iceTransportPolicy = iceTransportPolicy;
        this.repo = repo;
    }

    //
    // Peer States
    //

    onPeerAdded = async (ctx: Context, cid: number, pid: number, sources: MediaSources, capabilities: Capabilities, role: 'speaker' | 'listener') => {
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

    onPeerRoleChanged = async (ctx: Context, cid: number, pid: number, role: 'speaker' | 'listener') => {
        // noop
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
        this.endStreamDirectory.createStream(ctx, streamId1, {
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
        this.endStreamDirectory.createStream(ctx, streamId2, {
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

        // Notify peers
        this.repo.notifyPeerChanged(ctx, pid1);
        this.repo.notifyPeerChanged(ctx, pid2);
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

        // Reset negotiation
        this.endStreamDirectory.incrementSeq(ctx, link.esid1, 1);
        this.endStreamDirectory.incrementSeq(ctx, link.esid2, 1);
        this.endStreamDirectory.updateStream(ctx, link.esid1, { localSdp: null, remoteSdp: null });
        this.endStreamDirectory.updateStream(ctx, link.esid2, { localSdp: null, remoteSdp: null });

        if (link.leader === pid1) {
            if (link.pid1 === pid1) {
                this.endStreamDirectory.updateStream(ctx, link.esid1, { state: 'need-offer' });
                this.endStreamDirectory.updateStream(ctx, link.esid2, { state: 'wait-offer' });
            } else {
                this.endStreamDirectory.updateStream(ctx, link.esid2, { state: 'need-offer' });
                this.endStreamDirectory.updateStream(ctx, link.esid1, { state: 'wait-offer' });
            }
        } else {
            if (link.pid1 === pid1) {
                this.endStreamDirectory.updateStream(ctx, link.esid2, { state: 'need-offer' });
                this.endStreamDirectory.updateStream(ctx, link.esid1, { state: 'wait-offer' });
            } else {
                this.endStreamDirectory.updateStream(ctx, link.esid1, { state: 'need-offer' });
                this.endStreamDirectory.updateStream(ctx, link.esid2, { state: 'wait-offer' });
            }
        }

        // Update streams
        if (link.pid1 === pid1) {
            this.endStreamDirectory.updateStream(ctx, link.esid1, {
                localStreams: this.#getStreamGenericConfig(sources1),
                remoteStreams: this.#assignConfigPeer(this.#getStreamGenericConfig(sources2), pid2)
            });
            this.endStreamDirectory.updateStream(ctx, link.esid2, {
                localStreams: this.#getStreamGenericConfig(sources2),
                remoteStreams: this.#assignConfigPeer(this.#getStreamGenericConfig(sources1), pid1)
            });
        } else {
            this.endStreamDirectory.updateStream(ctx, link.esid2, {
                localStreams: this.#getStreamGenericConfig(sources1),
                remoteStreams: this.#assignConfigPeer(this.#getStreamGenericConfig(sources2), pid2)
            });
            this.endStreamDirectory.updateStream(ctx, link.esid1, {
                localStreams: this.#getStreamGenericConfig(sources2),
                remoteStreams: this.#assignConfigPeer(this.#getStreamGenericConfig(sources1), pid1)
            });
        }

        // Notify peers
        this.repo.notifyPeerChanged(ctx, pid1);
        this.repo.notifyPeerChanged(ctx, pid2);
    }

    #removeGenericLink = async (ctx: Context, cid: number, _pid1: number, _pid2: number) => {
        let link = await Store.ConferenceMeshLink.active.find(ctx, cid, Math.min(_pid1, _pid2), Math.max(_pid1, _pid2), KIND_GENERIC);
        if (!link || link.state === 'completed') {
            return;
        }
        await this.#cleanUpLink(ctx, link);
    }

    #getStreamGenericConfig = (streams: MediaSources): ProducerDescriptor[] => {
        let res: ProducerDescriptor[] = [];
        if (streams.videoStream) {
            res.push({ type: 'video', codec: 'h264', source: 'default', mid: null });
        }
        if (streams.audioStream) {
            res.push({ type: 'audio', codec: 'opus', mid: null });
        }
        return res;
    }
    #assignConfigPeer = (media: ProducerDescriptor[], pid: number) => {
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
        this.endStreamDirectory.createStream(ctx, streamProducerId, {
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
        this.endStreamDirectory.createStream(ctx, streamConsumerId, {
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

        // Notify peers
        this.repo.notifyPeerChanged(ctx, producerPid);
        this.repo.notifyPeerChanged(ctx, consumerPid);
    }

    #removeScreenCastLink = async (ctx: Context, cid: number, producerPid: number, consumerPid: number) => {
        let link = await Store.ConferenceMeshLink.active.find(ctx, cid, producerPid, consumerPid, KIND_SCREENCAST);
        if (!link || link.state === 'completed') {
            return;
        }
        await this.#cleanUpLink(ctx, link);

        // Notify peers
        this.repo.notifyPeerChanged(ctx, producerPid);
        this.repo.notifyPeerChanged(ctx, consumerPid);
    }

    #cleanUpLink = async (ctx: Context, link: ConferenceMeshLink) => {
        link.state = 'completed';

        // Stop streams
        let [stream1pid, stream2pid] = await Promise.all([
            this.endStreamDirectory.getPid(ctx, link.esid1),
            this.endStreamDirectory.getPid(ctx, link.esid2),
        ]);

        this.endStreamDirectory.updateStream(ctx, link.esid1, {
            state: 'completed',
            remoteCandidates: [],
            localCandidates: [],
            localSdp: null,
            remoteSdp: null,
            localStreams: [],
            remoteStreams: []
        });
        this.endStreamDirectory.updateStream(ctx, link.esid2, {
            state: 'completed',
            remoteCandidates: [],
            localCandidates: [],
            localSdp: null,
            remoteSdp: null,
            localStreams: [],
            remoteStreams: []
        });

        // Notify peers
        this.repo.notifyPeerChanged(ctx, stream1pid!);
        this.repo.notifyPeerChanged(ctx, stream2pid!);
    }

    #getStreamScreenCastConfig = (streams: MediaSources): ProducerDescriptor[] => {
        return [{ type: 'video', codec: 'h264', source: 'screen', mid: null }];
    }

    //
    // Streams
    //

    onStreamFailed = async (ctx: Context, cid: number, pid: number, sid: string) => {
        let link = (await Store.ConferenceMeshLink.conference.findAll(ctx, cid))
            .find((v) => v.esid1 === sid || v.esid2 === sid);
        if (!link || link.state === 'completed') {
            return;
        }

        let [stream1pid, stream2pid] = await Promise.all([
            this.endStreamDirectory.getPid(ctx, link.esid1),
            this.endStreamDirectory.getPid(ctx, link.esid2),
        ]);

        // Reset negotiation
        this.endStreamDirectory.incrementSeq(ctx, link.esid1, 1);
        this.endStreamDirectory.incrementSeq(ctx, link.esid2, 1);
        this.endStreamDirectory.updateStream(ctx, link.esid1, {
            localSdp: null,
            remoteSdp: null
        });
        this.endStreamDirectory.updateStream(ctx, link.esid2, {
            localSdp: null,
            remoteSdp: null
        });

        if (link.leader === link.pid1) {
            this.endStreamDirectory.updateStream(ctx, link.esid1, { state: 'need-offer' });
            this.endStreamDirectory.updateStream(ctx, link.esid2, { state: 'wait-offer' });
        } else {
            this.endStreamDirectory.updateStream(ctx, link.esid2, { state: 'need-offer' });
            this.endStreamDirectory.updateStream(ctx, link.esid1, { state: 'wait-offer' });
        }

        // Notify peers
        this.repo.notifyPeerChanged(ctx, stream1pid!);
        this.repo.notifyPeerChanged(ctx, stream2pid!);
    }

    onStreamCandidate = async (ctx: Context, cid: number, pid: number, sid: string, candidate: string) => {
        // logger.log(ctx, 'Candidate: ' + pid + ', ' + candidate);

        let link = (await Store.ConferenceMeshLink.conference.findAll(ctx, cid))
            .find((v) => v.esid1 === sid || v.esid2 === sid);
        if (!link || link.state === 'completed') {
            return;
        }

        let otherStreamId = link.esid1 === sid ? link.esid2 : link.esid1;
        let [
            otherStreamPid,
            otherStreamRemoteCandidates,
            otherStreamState
        ] = await Promise.all([
            this.endStreamDirectory.getPid(ctx, otherStreamId),
            this.endStreamDirectory.getRemoteCandidates(ctx, otherStreamId),
            this.endStreamDirectory.getState(ctx, otherStreamId),
        ]);

        if (!otherStreamPid || otherStreamState === 'completed') {
            return;
        }

        this.endStreamDirectory.updateStream(ctx, otherStreamId, { remoteCandidates: [...otherStreamRemoteCandidates!, candidate] });

        // Notify peer
        this.repo.notifyPeerChanged(ctx, otherStreamPid);
    }

    onStreamOffer = async (ctx: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null) => {
        logger.log(ctx, 'Offer: ' + pid + ', ' + offer);

        let link = (await Store.ConferenceMeshLink.conference.findAll(ctx, cid))
            .find((v) => v.esid1 === sid || v.esid2 === sid);
        if (!link || link.state !== 'wait-offer') {
            logger.log(ctx, 'exit1');
            return;
        }
        let otherStreamId = link.esid1 === sid ? link.esid2 : link.esid1;
        let [
            otherStreamPid,
            otherStreamState,
            otherStreamRemoteStreams,
            otherStreamLocalStreams
        ] = await Promise.all([
            this.endStreamDirectory.getPid(ctx, otherStreamId),
            this.endStreamDirectory.getState(ctx, otherStreamId),
            this.endStreamDirectory.getRemoteStreams(ctx, otherStreamId),
            this.endStreamDirectory.getLocalStreams(ctx, otherStreamId),
        ]);

        if (!otherStreamPid || otherStreamState === 'completed') {
            logger.log(ctx, 'exit2');
            return;
        }

        link.state = 'wait-answer';
        // still need to increment for back compatibility
        this.endStreamDirectory.incrementSeq(ctx, otherStreamId, 1);
        this.endStreamDirectory.updateStream(ctx, otherStreamId, {
            remoteSdp: offer,
            state: 'need-answer'
        });

        // Notify
        this.repo.notifyPeerChanged(ctx, otherStreamPid);

        //
        // Resolving MIDs
        //

        if (hints) {
            let remoteStreams = [...otherStreamRemoteStreams!];
            for (let i = 0; i < remoteStreams.length; i++) {
                if (remoteStreams[i].media.mid) {
                    continue;
                }
                let media = remoteStreams[i].media;
                let hint: StreamHint | null = null;
                if (media.type === 'audio') {
                    let m = hints.find((v) => v.kind === 'audio' && v.direction === 'SEND');
                    if (m) {
                        hint = m;
                    }
                } else if (media.type === 'video' && media.source === 'default') {
                    let m = hints.find((v) => v.kind === 'video' && (v.videoSource === null || v.videoSource === 'default') && v.direction === 'SEND');
                    if (m) {
                        hint = m;
                    }
                } else if (media.type === 'video' && media.source === 'screen') {
                    let m = hints.find((v) => v.kind === 'video' && v.videoSource === 'screen' && v.direction === 'SEND');
                    if (m) {
                        hint = m;
                    }
                }
                if (hint) {
                    remoteStreams[i] = {
                        ...remoteStreams[i],
                        media: {
                            ...media,
                            mid: hint.mid.toString()
                        }
                    };
                }
            }

            let localStreams = [...otherStreamLocalStreams!];
            for (let i = 0; i < localStreams.length; i++) {
                if (localStreams[i].mid) {
                    continue;
                }
                let media = localStreams[i];
                let hint: StreamHint | null = null;
                if (media.type === 'audio') {
                    let m = hints.find((v) => v.kind === 'audio' && v.direction === 'RECEIVE' && v.peerId === otherStreamPid);
                    if (m) {
                        hint = m;
                    }
                } else if (media.type === 'video' && media.source === 'default') {
                    let m = hints.find((v) => v.kind === 'video' && v.direction === 'RECEIVE' && v.peerId === otherStreamPid && (v.videoSource === null || v.videoSource === 'default'));
                    if (m) {
                        hint = m;
                    }
                } else if (media.type === 'video' && media.source === 'screen') {
                    let m = hints.find((v) => v.kind === 'video' && v.direction === 'RECEIVE' && v.peerId === otherStreamPid && v.videoSource === 'screen');
                    if (m) {
                        hint = m;
                    }
                }
                if (hint) {
                    localStreams[i] = {
                        ...localStreams[i],
                        mid: hint.mid
                    };
                }
            }

            this.endStreamDirectory.updateStream(ctx, otherStreamId, {
                remoteStreams,
                localStreams
            });
        } else {

            // Only at most stream of audio/video kind is supported
            if (otherStreamRemoteStreams!.filter((v) => v.media.type === 'audio').length > 1) {
                throw Error('Internal error');
            }
            if (otherStreamRemoteStreams!.filter((v) => v.media.type === 'video').length > 1) {
                throw Error('Internal error');
            }
            // Only at most stream of audio/video kind is supported
            if (otherStreamLocalStreams!.filter((v) => v.type === 'audio').length > 1) {
                throw Error('Internal error');
            }
            if (otherStreamLocalStreams!.filter((v) => v.type === 'video').length > 1) {
                throw Error('Internal error');
            }

            let session = parseSDP(JSON.parse(offer).sdp);

            // Remote Streams
            let remoteStreams = [...otherStreamRemoteStreams!];
            for (let i = 0; i < remoteStreams.length; i++) {
                if (remoteStreams[i].media.mid) {
                    continue;
                }
                let m = session.media.find((v) =>
                    v.type === remoteStreams[i].media.type && (v.direction === 'sendonly' || v.direction === 'sendrecv'));
                if (m && m.mid) {
                    remoteStreams[i] = {
                        ...remoteStreams[i],
                        media: {
                            ...remoteStreams[i].media,
                            mid: m.mid.toString()
                        }
                    };
                }
            }

            // Local Streams
            let localStreams = [...otherStreamLocalStreams!];
            for (let i = 0; i < localStreams.length; i++) {
                if (localStreams[i].mid) {
                    continue;
                }
                let m = session.media.find((v) =>
                    v.type === localStreams[i].type && (v.direction === 'recvonly' || v.direction === 'sendrecv'));
                if (m && m.mid) {
                    localStreams[i] = {
                        ...localStreams[i],
                        mid: m.mid.toString()
                    };
                }
            }

            this.endStreamDirectory.updateStream(ctx, otherStreamId, {
                remoteStreams,
                localStreams
            });
        }
    }

    onStreamAnswer = async (ctx: Context, cid: number, pid: number, sid: string, answer: string) => {
        logger.log(ctx, 'Answer: ' + pid + ', ' + answer);

        let link = (await Store.ConferenceMeshLink.conference.findAll(ctx, cid))
            .find((v) => v.esid1 === sid || v.esid2 === sid);
        if (!link || link.state !== 'wait-answer') {
            logger.log(ctx, 'exit1');
            return;
        }

        let [streamState, streamPid] = await Promise.all([
            this.endStreamDirectory.getState(ctx, sid),
            this.endStreamDirectory.getPid(ctx, sid)
        ]);
        if (!streamState) {
            return;
        }

        let otherStreamId = link.esid1 === sid ? link.esid2 : link.esid1;
        let [otherStreamState, otherStreamPid] = await Promise.all([
            this.endStreamDirectory.getState(ctx, otherStreamId),
            this.endStreamDirectory.getPid(ctx, otherStreamId),
        ]);
        if (!otherStreamState || otherStreamState === 'completed') {
            logger.log(ctx, 'exit2');
            return;
        }

        link.state = 'online';

        // move current stream to READY state
        this.endStreamDirectory.incrementSeq(ctx, sid, 1);
        this.endStreamDirectory.updateStream(ctx, sid, { state: 'online' });

        // still need to increment for back compatibility
        this.endStreamDirectory.incrementSeq(ctx, otherStreamId, 1);
        this.endStreamDirectory.updateStream(ctx, otherStreamId, { remoteSdp: answer, state: 'online' });

        this.repo.notifyPeerChanged(ctx, otherStreamPid!);
        this.repo.notifyPeerChanged(ctx, streamPid!);
    }
}