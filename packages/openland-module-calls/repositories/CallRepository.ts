import { Config } from 'openland-config/Config';
import { lazyInject } from 'openland-modules/Modules.container';
import { CallSchedulerKitchen } from './CallSchedulerKitchen';
import { CallSchedulerMesh } from './CallSchedulerMesh';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { ConferencePeer, ConferenceRoom } from '../../openland-module-db/store';
import { CallScheduler, MediaSources, StreamHint, Capabilities } from './CallScheduler';
import { createHyperlogger } from '../../openland-module-hyperlog/createHyperlogEvent';
import { notifyFastWatch } from 'openland-module-db/fastWatch';
import { DeliveryMediator } from '../../openland-module-messaging/mediators/DeliveryMediator';

let log = createLogger('call-repo');

let callEndedEvent = createHyperlogger<{ duration: number }>('call_ended');

export let DEFAULT_CAPABILITIES: Capabilities = {
    codecs: [{
        kind: 'audio',
        mimeType: 'audio/opus',
        preferredPayloadType: 109,
        clockRate: 48000,
        channels: 2,
        parameters: [
            { key: 'maxplaybackrate', value: '48000' },
            { key: 'stereo', value: '1' },
            { key: 'useinbandfec', value: '1' }
        ],
        rtcpFeedback: []
    }, {
        kind: 'video',
        mimeType: 'video/H264',
        preferredPayloadType: 125,
        clockRate: 90000,
        channels: null,
        parameters: [
            { key: 'level-asymmetry-allowed', value: '1' },
            { key: 'packetization-mode', value: '1' },
            { key: 'profile-level-id', value: '42e01f' },
        ],
        rtcpFeedback: []
    }],
    headerExtensions: []
};

@injectable()
export class CallRepository {

    readonly defaultScheduler: 'mesh' | 'mesh-no-relay' | 'basic-sfu' = Config.environment === 'production' ? 'basic-sfu' : 'mesh';
    readonly schedulerMesh = new CallSchedulerMesh('relay');
    readonly schedulerMeshNoRelay = new CallSchedulerMesh('all');

    @lazyInject('CallSchedulerKitchen')
    readonly schedulerKitchen!: CallSchedulerKitchen;
    @lazyInject('DeliveryMediator')
    readonly delivery!: DeliveryMediator;

    getOrCreateConference = async (parent: Context, cid: number) => {
        return await inTx(parent, async (ctx) => {
            let res = await Store.ConferenceRoom.findById(ctx, cid);
            if (!res) {
                res = await Store.ConferenceRoom.create(ctx, cid, {
                    scheduler: this.defaultScheduler,
                    currentScheduler: this.defaultScheduler,
                    kind: 'conference',
                    startTime: null
                });
            }
            return res;
        });
    }

    getScheduler(kind: 'mesh' | 'mesh-no-relay' | 'basic-sfu' | null): CallScheduler {
        if (kind === 'mesh' || kind === null) {
            return this.schedulerMesh;
        } else if (kind === 'mesh-no-relay') {
            return this.schedulerMeshNoRelay;
        } else if (kind === 'basic-sfu') {
            return this.schedulerKitchen;
        } else {
            throw Error('Unsupported scheduler: ' + kind);
        }
    }

    addPeer = async (parent: Context, cid: number, uid: number, tid: string, timeout: number, kind: 'conference' | 'stream' = 'conference', capabilities: Capabilities | null, ip: string) => {
        return await inTx(parent, async (ctx) => {
            // let room = await this.entities.ConferenceRoom.findById(ctx, cid);
            // if (!room) {
            //     throw Error('Unable to find room');
            // }

            log.log(ctx, 'Add peer: ' + cid + ': ' + uid + ' (ip: ' + ip + ')');

            // Handle Call Restart
            let confPeers = await Store.ConferencePeer.conference.findAll(ctx, cid);
            let conf = await this.getOrCreateConference(ctx, cid);
            let justStarted = false;
            if (confPeers.length === 0) {

                // Reset Start Time
                conf.startTime = Date.now();
                conf.active = true;

                // Update conference type: broadcasting, simple conference
                conf.kind = kind;
                conf.streamerId = conf.kind === 'stream' ? uid : null;

                // Assign scheduler for this calls
                if (conf.scheduler) {
                    conf.currentScheduler = conf.scheduler;
                } else {
                    conf.currentScheduler = this.defaultScheduler; // Default Scheduler
                }

                // Flush for better correctness
                await conf.flush(ctx);

                await this.onConferenceStarted(ctx, conf);

                justStarted = true;
            }

            // Resolve scheduler
            let scheduler = this.getScheduler(conf.currentScheduler);

            // Detect call start
            if (justStarted) {
                log.log(ctx, 'Conference started: ' + cid);
                await scheduler.onConferenceStarted(ctx, cid);

                // Notify all about call state
                await this.delivery.onCallStateChanged(ctx, cid, true);
            }

            // Remove peer for same auth token
            let existing = await Store.ConferencePeer.auth.find(ctx, cid, uid, tid);
            if (existing && existing.enabled) {
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
            });

            // Handle scheduling
            let cap = capabilities;
            if (!cap) {
                cap = DEFAULT_CAPABILITIES;
            }
            await scheduler.onPeerAdded(ctx, conf.id, id, this.#getStreams(res, conf), cap);

            // Notify state change
            await this.notifyConferenceChanged(ctx, cid);
            return res;
        });
    }

    alterConferencePeerMediaState = async (parent: Context, cid: number, uid: number, tid: string, audioPaused: boolean | null, videoPaused: boolean | null) => {
        return await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.auth.find(ctx, cid, uid, tid);
            let conf = await this.getOrCreateConference(ctx, cid);
            if (!peer) {
                throw Error('Unable to find peer');
            }
            if (!peer.enabled) {
                return conf;
            }
            peer.audioPaused = typeof audioPaused === 'boolean' ? audioPaused : peer.audioPaused;
            peer.videoPaused = typeof videoPaused === 'boolean' ? videoPaused : peer.videoPaused;

            // Scheduling
            let scheduler = this.getScheduler(conf.currentScheduler);
            await scheduler.onPeerStreamsChanged(ctx, conf.id, peer.id, this.#getStreams(peer, conf));

            // Notify state change
            await this.notifyConferenceChanged(ctx, cid);
            return await this.getOrCreateConference(ctx, cid);
        });
    }

    conferenceRequestLocalMediaChange = async (
        parent: Context, cid: number, uid: number, tid: string,
        media: {
            supportsVideo: boolean;
            supportsAudio: boolean;
            wantSendVideo: boolean;
            wantSendAudio: boolean;
            wantSendScreencast: boolean;
        }) => {
        return await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.auth.find(ctx, cid, uid, tid);
            let conf = await this.getOrCreateConference(ctx, cid);
            if (!peer) {
                throw Error('Unable to find peer');
            }
            if (!peer.enabled) {
                return conf;
            }
            peer.audioPaused = !media.wantSendAudio;
            peer.videoPaused = !media.wantSendVideo;
            if (media.wantSendScreencast) {
                await this.addScreenShare(ctx, cid, uid, tid);
            } else {
                await this.removeScreenShare(ctx, peer);
            }

            // Scheduling
            let scheduler = this.getScheduler(conf.currentScheduler);
            await scheduler.onPeerStreamsChanged(ctx, conf.id, peer.id, this.#getStreams(peer, conf));

            // Notify state change
            await this.notifyConferenceChanged(ctx, cid);
            return await this.getOrCreateConference(ctx, cid);
        });
    }

    //
    // Screen Sharing
    //

    addScreenShare = async (parent: Context, cid: number, uid: number, tid: string) => {
        return await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, cid);
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

            // Scheduling
            let scheduler = this.getScheduler(conf.currentScheduler);
            await scheduler.onPeerStreamsChanged(ctx, conf.id, peer.id, this.#getStreams(peer, conf));

            // Notify state change
            await this.notifyConferenceChanged(ctx, cid);
            return conf;
        });
    }

    removeScreenShare = async (parent: Context, peer: ConferencePeer) => {
        return await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, peer.cid);
            if (conf.screenSharingPeerId !== peer.id) {
                return conf;
            }

            conf.screenSharingPeerId = null;

            // Scheduling
            let scheduler = this.getScheduler(conf.currentScheduler);
            await scheduler.onPeerStreamsChanged(ctx, conf.id, peer.id, this.#getStreams(peer, conf));

            // Notify state change
            await this.notifyConferenceChanged(ctx, peer.cid);
            return conf;
        });
    }

    //
    // Conference End
    //

    endConference = async (parent: Context, cid: number) => {
        await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, cid);
            let scheduler = this.getScheduler(conf.currentScheduler);

            let members = await this.findActiveMembers(ctx, cid);
            for (let m of members) {
                await this.#doRemovePeer(ctx, m.id, false);
            }
            if (members.length > 0) {
                log.log(ctx, 'Conference ended (end conference): ' + cid);
                await scheduler.onConferenceStopped(ctx, cid);

                conf.active = false;
                await this.onConferenceEnded(ctx, conf);
            }
        });
    }

    //
    // Peer Removing
    //

    removePeer = async (parent: Context, pid: number) => {
        //
        // WARNING: Making multiple peer removal at the same transcation can yield different results!
        //
        return await this.#doRemovePeer(parent, pid, true);
    }

    #doRemovePeer = async (parent: Context, pid: number, detectEnd: boolean) => {
        await inTx(parent, async (ctx) => {

            // Remove Peer
            let existing = await Store.ConferencePeer.findById(ctx, pid);
            if (!existing) {
                throw Error('Unable to find peer: ' + pid);
            }
            if (!existing.enabled) {
                return;
            }
            existing.enabled = false;
            await existing.flush(ctx);

            log.log(ctx, 'Remove peer: ' + existing.cid + ': ' + existing.uid);

            // Handle media scheduling
            let conf = await this.getOrCreateConference(ctx, existing.cid);
            let scheduler = this.getScheduler(conf.currentScheduler);

            // Handle Peer removal
            await scheduler.onPeerRemoved(ctx, conf.id, pid);

            // Detect call end
            if (detectEnd) {
                if ((await this.findActiveMembers(ctx, existing.cid)).length === 0) {
                    log.log(ctx, 'Conference ended (remove): ' + existing.cid);
                    await scheduler.onConferenceStopped(ctx, existing.cid);

                    conf.active = false;
                    await this.onConferenceEnded(ctx, conf);
                }
            }

            // Fast watch notify
            await this.notifyConferenceChanged(ctx, existing.cid);
        });
    }

    //
    // Keep Alive
    //

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
        let now = Date.now();
        let active = await Store.ConferencePeer.active.findAll(parent);
        for (let a of active) {
            if (a.keepAliveTimeout < now) {
                await inTx(parent, async (ctx) => {
                    let peer = (await Store.ConferencePeer.findById(ctx, a.id))!;
                    if (peer.enabled && peer.keepAliveTimeout < now) {
                        log.log(ctx, 'Call Participant Reaped: ' + a.uid + ' from ' + a.cid);
                        await this.removePeer(ctx, a.id);
                        // await this.bumpVersion(ctx, a.cid, a.id);
                    }
                });
            }
        }
    }

    //
    // Conference hooks
    //

    onConferenceEnded = async (ctx: Context, conf: ConferenceRoom) => {
        // Show conference in dialogs list
        await this.delivery.onCallStateChanged(ctx, conf.id, false);

        if (conf.startTime) {
            callEndedEvent.event(ctx, { duration: Date.now() - conf.startTime! });
        }
    }

    onConferenceStarted = async (ctx: Context, conf: ConferenceRoom) => {
        await this.delivery.onCallStateChanged(ctx, conf.id, true);
    }

    //
    // Streams
    //

    streamOffer = async (
        parent: Context,
        streamId: string,
        peerId: number,
        offer: string,
        seq: number | null | undefined,
        hints: StreamHint[] | null | undefined
    ) => {
        await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }
            let conf = await this.getOrCreateConference(ctx, peer.cid);
            let scheduler = this.getScheduler(conf.currentScheduler);

            // Update Stream
            let stream = await Store.ConferenceEndStream.findById(ctx, streamId);
            if (!stream) {
                throw Error('Unable to find stream');
            }
            if (seq !== undefined && seq !== stream.seq) {
                return;
            }
            if (stream.state !== 'need-offer') {
                return;
            }
            stream.localSdp = offer;
            stream.state = 'wait-answer';

            // Schedule
            await scheduler.onStreamOffer(ctx, peer.cid, peer.id, streamId, offer, hints ? hints : null);
            await stream.flush(ctx);

            // Notify state change
            await this.bumpVersion(ctx, peer.cid, peer.id);
        });
    }

    streamAnswer = async (parent: Context, streamId: string, peerId: number, answer: string, seq?: number) => {
        await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }
            let conf = await this.getOrCreateConference(ctx, peer.cid);
            let scheduler = this.getScheduler(conf.currentScheduler);

            // Update Stream
            let stream = await Store.ConferenceEndStream.findById(ctx, streamId);
            if (!stream) {
                throw Error('Unable to find stream');
            }
            if (seq !== undefined && seq !== stream.seq) {
                return;
            }
            if (stream.state !== 'need-answer') {
                return;
            }
            stream.localSdp = answer;
            stream.state = 'online';

            // Schedule
            await scheduler.onStreamAnswer(ctx, peer.cid, peer.id, streamId, answer);
            await stream.flush(ctx);

            // Bump version
            await this.bumpVersion(ctx, peer.cid, peer.id);
        });
    }

    streamCandidate = async (parent: Context, streamId: string, peerId: number, candidate: string) => {
        await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }
            let conf = await this.getOrCreateConference(ctx, peer.cid);
            let scheduler = this.getScheduler(conf.currentScheduler);

            // Update Stream
            let stream = await Store.ConferenceEndStream.findById(ctx, streamId);
            if (!stream) {
                throw Error('Unable to find stream');
            }
            if (stream.state === 'completed') {
                return;
            }
            if (stream.localCandidates.find((v) => v === candidate)) {
                return;
            }
            stream.localCandidates = [...stream.localCandidates, candidate];

            // Scheduling
            await scheduler.onStreamCandidate(ctx, peer.cid, peer.id, streamId, candidate);
            await stream.flush(ctx);

            // Bump version
            await this.bumpVersion(ctx, peer.cid, peer.id);
        });
    }

    streamFailed = async (parent: Context, streamId: string, peerId: number) => {
        await inTx(parent, async (ctx) => {
            let peer = await Store.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }
            let conf = await this.getOrCreateConference(ctx, peer.cid);
            let scheduler = this.getScheduler(conf.currentScheduler);

            await scheduler.onStreamFailed(ctx, peer.cid, peer.id, streamId);

            // Bump version
            await this.bumpVersion(ctx, peer.cid, peer.id);
        });
    }

    //
    // Queries
    //

    findActiveMembers = async (parent: Context, cid: number) => {
        return await Store.ConferencePeer.conference.findAll(parent, cid);
    }

    // Deprecated
    bumpVersion = async (parent: Context, cid: number, pid: number) => {
        // await inTx(parent, async (ctx) => {
        //     let conf = await this.getOrCreateConference(ctx, cid);
        //     conf.invalidate();
        // });
        await this.notifyConferenceChanged(parent, cid);
    }

    notifyConferenceChanged = async (parent: Context, cid: number) => {
        await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, cid);
            conf.invalidate();
            notifyFastWatch(ctx, 'conference-' + cid);
        });
    }

    #getStreams = (peer: ConferencePeer, conference: ConferenceRoom): MediaSources => {
        let res: MediaSources = {
            videoStream: peer.videoPaused === false,
            screenCastStream: conference.screenSharingPeerId === peer.id,
            audioStream: true
        };
        return res;
    }
}