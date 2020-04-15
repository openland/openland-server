import { CallSchedulerMesh } from './CallSchedulerMesh';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { ConferencePeer, ConferenceRoom } from '../../openland-module-db/store';
import { CallScheduler } from './CallScheduler';

let log = createLogger('call-repo');

interface AbsConferenceArgs {
    peer1: number;
    peer2: number;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    iceTransportPolicy?: 'all' | 'relay' | null;
    videoOutSource?: 'camera' | 'screen_share';
}

interface ConfArgs extends AbsConferenceArgs {
    confType: 'conference';
}
interface StreamArgs extends AbsConferenceArgs {
    confType: 'stream';
    streamerId: number;
}
function resolveMediaStreamSettings(args: ConfArgs | StreamArgs) {
    let audioEnabled = args.audioEnabled !== false;
    let videoEnabled = args.videoEnabled !== false;
    let iceTransportPolicy = args.iceTransportPolicy || 'relay';
    let videoOutSource = args.videoOutSource || 'camera';
    if (args.confType === 'conference') {
        let settings = {
            audioIn: audioEnabled,
            audioOut: audioEnabled,
            videoIn: videoEnabled,
            videoOut: videoEnabled,
            iceTransportPolicy,
            videoOutSource
        };
        return [settings, settings];
    } else {
        let settings = {
            audioIn: false,
            audioOut: false,
            videoIn: false,
            videoOut: false,
            iceTransportPolicy: iceTransportPolicy,
            videoOutSource: undefined
        };
        let settingsStreamer = { ...settings, ...{ audioOut: audioEnabled, videoOut: videoEnabled, videoOutSource } };
        let settingsConsumer = { ...settings, ...{ audioIn: audioEnabled, videoIn: videoEnabled } };
        return args.peer1 === args.streamerId ? [settingsStreamer, settingsConsumer] : [settingsConsumer, settingsStreamer];
    }
}

@injectable()
export class CallRepository {

    private readonly schedulerMesh = new CallSchedulerMesh('relay');
    private readonly schedulerMeshNoRelay = new CallSchedulerMesh('all');

    getOrCreateConference = async (parent: Context, cid: number) => {
        return await inTx(parent, async (ctx) => {
            let res = await Store.ConferenceRoom.findById(ctx, cid);
            if (!res) {
                res = await Store.ConferenceRoom.create(ctx, cid, { scheduler: 'mesh', currentScheduler: 'mesh', kind: 'conference', startTime: null });
            }
            return res;
        });
    }

    getScheduler(kind: 'mesh' | 'mesh-no-relay' | 'basic-sfu' | null): CallScheduler {
        if (kind === 'mesh' || kind === null) {
            return this.schedulerMesh;
        } else if (kind === 'mesh-no-relay') {
            return this.schedulerMeshNoRelay;
        } else {
            throw Error('Unsupported scheduler: ' + kind);
        }
    }

    addPeer = async (parent: Context, cid: number, uid: number, tid: string, timeout: number, kind: 'conference' | 'stream' = 'conference') => {
        return await inTx(parent, async (ctx) => {
            // let room = await this.entities.ConferenceRoom.findById(ctx, cid);
            // if (!room) {
            //     throw Error('Unable to find room');
            // }

            // Handle Call Restart
            let confPeers = await Store.ConferencePeer.conference.findAll(ctx, cid);
            let conf = await this.getOrCreateConference(ctx, cid);
            let justStarted = false;
            if (confPeers.length === 0) {

                // Reset Start Time
                conf.startTime = Date.now();

                // Update conference type: broadcasting, simple conference
                conf.kind = kind;
                conf.streamerId = conf.kind === 'stream' ? uid : null;

                // Assign scheduler for this calls
                if (conf.scheduler) {
                    conf.currentScheduler = conf.scheduler;
                } else {
                    conf.currentScheduler = 'mesh-no-relay'; // Default Scheduler
                }

                // Flush for better correctness
                await conf.flush(ctx);

                justStarted = true;
            }

            // Resolve Scheduler
            let scheduler = this.getScheduler(conf.currentScheduler);
            let iceTransportPolicy = await scheduler.getIceTransportPolicy();

            // Handle call starting
            if (justStarted) {
                await scheduler.onConferenceStarted(ctx, cid);
            }

            // Remove peer for same auth token
            let existing = await Store.ConferencePeer.auth.find(ctx, cid, uid, tid);
            if (existing) {
                await this.#doRemovePeer(ctx, existing.id, false);
            }

            // Create new peer
            let seq = (await Store.Sequence.findById(ctx, 'conference-peer-id'));
            if (!seq) {
                seq = await Store.Sequence.create(ctx, 'conference-peer-id', { value: 0 });
            }
            let id = ++seq.value;
            await seq.flush(ctx);
            let res = await Store.ConferencePeer.create(ctx, id, {
                cid, uid, tid,
                keepAliveTimeout: Date.now() + timeout,
                enabled: true,
                audioEnabled: true,
                videoEnabled: true
            });

            // Create streams
            for (let cp of confPeers) {
                if (cp.id === id) {
                    continue;
                }
                let peer1 = Math.min(cp.id, id);
                let peer2 = Math.max(cp.id, id);
                let peer1Obj = cp.id === peer1 ? cp : res;
                let peer2Obj = cp.id === peer2 ? cp : res;

                let [settings1, settings2] = resolveMediaStreamSettings({
                    peer1, peer2, iceTransportPolicy: iceTransportPolicy,
                    ...conf.kind === 'conference' ?
                        { confType: 'conference' } :
                        { confType: 'stream', streamerId: conf.streamerId! }
                });

                // if (room.strategy === 'direct') {
                await Store.ConferenceMediaStream.create(ctx, await this.nextStreamId(ctx), {
                    kind: 'direct',
                    peer1,
                    peer2,
                    cid: cid,
                    state: 'wait-offer',
                    ice1: [],
                    ice2: [],
                    offer: null,
                    answer: null,
                    settings1,
                    settings2,
                    seq: 0,
                    mediaState1: { audioOut: !!peer1Obj.audioEnabled, videoOut: !!peer1Obj.videoEnabled, videoSource: 'camera' },
                    mediaState2: { audioOut: !!peer2Obj.audioEnabled, videoOut: !!peer2Obj.videoEnabled, videoSource: 'camera' }
                });

                if (cp.id === conf.screenSharingPeerId) {
                    await this.createScreenShareStream(ctx, conf, scheduler, cp, res);
                }
                // }
            }

            await this.bumpVersion(ctx, cid);
            return res;
        });
    }

    addScreenShare = async (parent: Context, cid: number, uid: number, tid: string) => {
        return await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, cid);
            let confPeers = await Store.ConferencePeer.conference.findAll(ctx, cid);
            let peer = await Store.ConferencePeer.auth.find(ctx, cid, uid, tid);
            if (!peer) {
                throw Error('Unable to find peer');
            }
            if (conf.screenSharingPeerId === peer.id) {
                return conf;
            }
            let currentSharingPeer = conf.screenSharingPeerId ? await Store.ConferencePeer.findById(ctx, conf.screenSharingPeerId) : undefined;
            if (currentSharingPeer) {
                conf = await this.removeScreenShare(ctx, currentSharingPeer);
            }
            conf.screenSharingPeerId = peer.id;

            // Resolve scheduler
            let scheduler = this.getScheduler(conf.currentScheduler);

            // Create streams
            for (let cp of confPeers) {
                if (cp.id === peer.id) {
                    continue;
                }
                await this.createScreenShareStream(ctx, conf, scheduler, peer, cp);
            }
            await this.bumpVersion(ctx, cid);
            return conf;
        });
    }

    createScreenShareStream = async (ctx: Context, conf: ConferenceRoom, scheduler: CallScheduler, producer: ConferencePeer, consumer: ConferencePeer) => {
        let peer1 = Math.min(consumer.id, producer.id);
        let peer2 = Math.max(consumer.id, producer.id);
        let policy = await scheduler.getIceTransportPolicy();

        let [settings1, settings2] = resolveMediaStreamSettings({
            confType: 'stream',
            peer1, peer2,
            streamerId: producer.id,
            iceTransportPolicy: policy,
            videoOutSource: 'screen_share',
            audioEnabled: false
        });

        await Store.ConferenceMediaStream.create(ctx, await this.nextStreamId(ctx), {
            kind: 'direct',
            peer1,
            peer2,
            cid: conf.id,
            state: 'wait-offer',
            ice1: [],
            ice2: [],
            offer: null,
            answer: null,
            settings1,
            settings2,
            seq: 0,
            mediaState1: { audioOut: false, videoOut: peer1 === producer.id, videoSource: peer1 === producer.id ? 'screen_share' : undefined },
            mediaState2: { audioOut: false, videoOut: peer2 === producer.id, videoSource: peer2 === producer.id ? 'screen_share' : undefined }
        });
    }

    removeScreenShare = async (parent: Context, peer: ConferencePeer) => {
        return await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, peer.cid);
            if (conf.screenSharingPeerId !== peer.id) {
                return conf;
            }
            conf.screenSharingPeerId = null;
            // Kill screen_share streams
            let streams = await Store.ConferenceMediaStream.conference.findAll(ctx, peer.cid);
            for (let c of streams) {
                if ((c.peer1 === peer.id && c.mediaState1!.videoSource === 'screen_share') || (c.peer2 === peer.id && c.mediaState2!.videoSource === 'screen_share')) {
                    c.state = 'completed';
                }
            }

            await this.bumpVersion(ctx, peer.cid);
            return conf;
        });
    }

    alterConferencePeerMediaState = async (parent: Context, cid: number, uid: number, tid: string, audioOut: boolean | null, videoOut: boolean | null) => {
        return await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.auth.find(ctx, cid, uid, tid);
            if (!peer) {
                throw Error('Unable to find peer');
            }
            peer.audioEnabled = typeof audioOut === 'boolean' ? audioOut : peer.audioEnabled;
            peer.videoEnabled = typeof videoOut === 'boolean' ? videoOut : peer.videoEnabled;
            let streams = await Store.ConferenceMediaStream.conference.findAll(ctx, cid);
            for (let stream of streams.filter(s => (s.peer1 === peer!.id) || (s.peer2 === peer!.id))) {
                let change = { ...(typeof audioOut === 'boolean') ? { audioOut } : {}, ...(typeof videoOut === 'boolean') ? { videoOut } : {} };
                if (stream.peer1 === peer!.id) {
                    stream.mediaState1 = { ...stream.mediaState1!, ...change };
                } else {
                    stream.mediaState2 = { ...stream.mediaState2!, ...change };
                }
            }
            await this.bumpVersion(ctx, cid);
            return await this.getOrCreateConference(ctx, cid);
        });
    }

    endConference = async (parent: Context, cid: number) => {
        await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, cid);
            let scheduler = this.getScheduler(conf.currentScheduler);

            let members = await this.findActiveMembers(ctx, cid);
            for (let m of members) {
                await this.#doRemovePeer(ctx, m.id, false);
            }
            if (members.length > 0) {
                await scheduler.onConferenceStopped(ctx, cid);
            }
        });
    }

    removePeer = async (parent: Context, pid: number) => {
        //
        // WARNING: Making multiple peer removal at the same transcation can yield different results!
        //
        return await this.#doRemovePeer(parent, pid, true);
    }

    #doRemovePeer = async (parent: Context, pid: number, detectEnd: boolean) => {
        await inTx(parent, async (ctx) => {
            // Resolve Peer
            let existing = await Store.ConferencePeer.findById(ctx, pid);
            if (!existing) {
                throw Error('Unable to find peer: ' + pid);
            }
            if (!existing.enabled) {
                return;
            }
            existing.enabled = false;
            await existing.flush(ctx);

            // Detect End
            let conf = await this.getOrCreateConference(ctx, existing.cid);
            let scheduler = this.getScheduler(conf.currentScheduler);
            if (detectEnd) {
                if ((await Store.ConferencePeer.active.findAll(ctx)).length === 0) {
                    await scheduler.onConferenceStopped(ctx, existing.cid);
                }
            }

            // Kill all streams
            let streams = await Store.ConferenceMediaStream.conference.findAll(ctx, existing.cid);
            for (let c of streams) {
                if (c.kind === 'bridged' && c.peer1 === pid) {
                    c.state = 'completed';
                } else if (c.kind === 'direct' && (c.peer1 === pid || c.peer2 === pid)) {
                    c.state = 'completed';
                }
            }

            await this.bumpVersion(ctx, existing.cid);
        });
    }

    peerKeepAlive = async (parent: Context, cid: number, pid: number, timeout: number) => {
        return await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.findById(ctx, pid);
            if (!peer) {
                return false;
            }
            if (peer.cid !== cid) {
                throw Error('Conference id mismatch');
            }
            if (!peer.enabled) {
                return false;
            }
            peer.keepAliveTimeout = Date.now() + timeout;
            return true;
        });
    }

    checkTimeouts = async (parent: Context) => {
        await inTx(parent, async (ctx) => {
            let active = await Store.ConferencePeer.active.findAll(ctx);
            let now = Date.now();
            for (let a of active) {
                if (a.keepAliveTimeout < now) {
                    log.log(ctx, 'Call Participant Reaped: ' + a.uid + ' from ' + a.cid);
                    await this.removePeer(ctx, a.id);
                    await this.bumpVersion(ctx, a.cid);
                }
            }
        });
    }

    // Streams

    streamOffer = async (parent: Context, id: number, peerId: number, offer: string, seq?: number) => {
        await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }

            let stream = await Store.ConferenceMediaStream.findById(ctx, id);
            if (!stream) {
                throw Error('Unable to find stream');
            }

            if (seq !== undefined && seq !== stream.seq) {
                return;
            }

            if (stream.kind === 'direct') {
                if (stream.peer1 !== peerId) {
                    throw Error('Invalid peerId');
                }
                if (stream.state !== 'wait-offer') {
                    return;
                }
            } else {
                throw Error('Invalid peerId');
            }

            stream.offer = offer;
            stream.state = 'wait-answer';
            if (stream.seq !== null) {
                stream.seq++;
            } else {
                stream.seq = 1;
            }
            await stream.flush(ctx);
            await this.bumpVersion(ctx, stream!.cid);
        });
    }

    streamAnswer = async (parent: Context, id: number, peerId: number, answer: string, seq?: number) => {
        await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }
            let stream = await Store.ConferenceMediaStream.findById(ctx, id);
            if (!stream) {
                throw Error('Unable to find stream');
            }

            if (seq !== undefined && seq !== stream.seq) {
                return;
            }

            if (stream.kind === 'direct') {
                if (stream.peer2 !== peerId) {
                    throw Error('Invalid peerId');
                }
                if (stream.state !== 'wait-answer') {
                    return;
                }
                stream.answer = answer;
                stream.state = 'online';
            } else if (stream.kind === 'bridged') {
                if (stream.peer1 !== peerId) {
                    throw Error('Invalid peerId');
                }
                if (stream.state !== 'wait-answer') {
                    return;
                }
                stream.answer = answer;
                stream.state = 'online';
            }
            if (stream.seq !== null) {
                stream.seq++;
            } else {
                stream.seq = 1;
            }
            await stream.flush(ctx);
            await this.bumpVersion(ctx, stream!.cid);
        });
    }

    streamNegotiationNeeded = async (parent: Context, id: number, peerId: number, seq?: number) => {
        await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }
            let stream = await Store.ConferenceMediaStream.findById(ctx, id);
            if (!stream) {
                throw Error('Unable to find stream');
            }

            if (seq === undefined && stream.state !== 'online') {
                // old clients without seq
                return;
            }

            stream.offer = null;
            stream.answer = null;
            stream.state = 'wait-offer';
            if (stream.seq !== null) {
                stream.seq++;
            } else {
                stream.seq = 1;
            }
            await stream.flush(ctx);
            await this.bumpVersion(ctx, stream!.cid);
        });
    }

    streamFailed = async (parent: Context, id: number, peerId: number) => {
        await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }
            let stream = await Store.ConferenceMediaStream.findById(ctx, id);
            if (!stream) {
                throw Error('Unable to find stream');
            }

            if (stream.state !== 'completed') {
                stream.state = 'completed';

                await Store.ConferenceMediaStream.create(ctx, await this.nextStreamId(ctx), {
                    kind: 'direct',
                    peer1: stream.peer1,
                    peer2: stream.peer2,
                    cid: stream.cid,
                    state: 'wait-offer',
                    ice1: [],
                    ice2: [],
                    offer: null,
                    answer: null,
                    settings1: stream.settings1,
                    settings2: stream.settings2,
                    seq: 0,
                    mediaState1: stream.mediaState1,
                    mediaState2: stream.mediaState2
                });
            }

            await this.bumpVersion(ctx, stream!.cid);
        });
    }

    streamCandidate = async (parent: Context, id: number, peerId: number, candidate: string) => {
        await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }
            let stream = await Store.ConferenceMediaStream.findById(ctx, id);
            if (!stream) {
                throw Error('Unable to find stream');
            }

            if (stream.peer1 === peerId) {
                stream.ice1 = [...stream.ice1, candidate];
            } else if (stream.peer2 === peerId) {
                stream.ice2 = [...stream.ice2, candidate];
            } else {
                throw Error('Unable to find stream');
            }
            await stream.flush(ctx);
            await this.bumpVersion(ctx, stream!.cid);
        });
    }

    //
    // Queries
    //

    findActiveMembers = async (parent: Context, cid: number) => {
        return await Store.ConferencePeer.conference.findAll(parent, cid);
    }

    private bumpVersion = async (parent: Context, cid: number) => {
        await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, cid);
            conf.invalidate();
        });
    }

    private nextStreamId = async (parent: Context) => {
        return await inTx(parent, async (ctx) => {
            let ex = await Store.Sequence.findById(ctx, 'media-stream-id');
            if (ex) {
                ex.value++;
                let res = ex.value;
                await ex.flush(ctx);
                return res;
            } else {
                await Store.Sequence.create(ctx, 'media-stream-id', { value: 1 });
                return 1;
            }
        });
    }
}