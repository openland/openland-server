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
import { notifyFastWatch } from 'openland-module-db/fastWatch';
import { DeliveryMediator } from '../../openland-module-messaging/mediators/DeliveryMediator';
import { Events } from 'openland-module-hyperlog/Events';
import {
    VoiceChatParticipantStatus
} from '../../openland-module-voice-chats/repositories/ParticipantsRepository';
import { Modules } from '../../openland-modules/Modules';
import { KeepAliveCollection } from '../../openland-module-db/collections/KeepAliveCollection';
import { EndStreamDirectory } from './EndStreamDirectory';

let log = createLogger('call-repo');

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

type MediaSettings = {
    supportsVideo: boolean;
    supportsAudio: boolean;
    wantSendVideo: boolean;
    wantSendAudio: boolean;
    wantSendScreencast: boolean;
};

type AddPeerInput = {
    cid: number,
    uid: number,
    tid: string,
    timeout: number,
    kind: 'conference' | 'stream',
    capabilities: Capabilities | null,
    media?: MediaSettings | undefined,
    ip: string,
    role?: 'speaker' | 'listener'
};

@injectable()
export class CallRepository {

    readonly defaultScheduler: 'mesh' | 'mesh-no-relay' | 'basic-sfu' = Config.environment === 'production' ? 'basic-sfu' : 'mesh';
    readonly schedulerMesh = new CallSchedulerMesh('relay', this);
    readonly schedulerMeshNoRelay = new CallSchedulerMesh('all', this);
    readonly endStreamDirectory = new EndStreamDirectory(Store.EndStreamDirectory);

    @lazyInject('CallSchedulerKitchen')
    readonly schedulerKitchen!: CallSchedulerKitchen;
    @lazyInject('DeliveryMediator')
    readonly delivery!: DeliveryMediator;

    private keepAlive = new KeepAliveCollection(Store.ConferencePeerKeepAliveDirectory);

    getOrCreateConference = async (parent: Context, cid: number) => {
        return await inTx(parent, async (ctx) => {
            let res = await Store.ConferenceRoom.findById(ctx, cid);
            if (!res) {
                res = await Store.ConferenceRoom.create(ctx, cid, {
                    kind: 'conference',
                    startTime: null
                });
            }
            return res;
        });
    }

    hasActiveCall = async (ctx: Context, cid: number) => {
        let res = await Store.ConferenceRoom.findById(ctx, cid);
        if (!res) {
            return false;
        }
        return res.active || false;
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

    addPeer = async (parent: Context, input: AddPeerInput) => {
        return await inTx(parent, async (ctx) => {
            let {
                cid,
                uid,
                tid,
                timeout,
                kind,
                capabilities,
                media,
                ip,
                role
            } = input;

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
                await this.#doRemovePeer(ctx, existing.id, false, false);
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
                role: role || 'speaker',
                keepAliveTimeout: Date.now() + timeout,
                enabled: true,
                audioPaused: !media?.wantSendAudio,
                videoPaused: !media?.wantSendVideo,
            });

            this.keepAlive.keepAlive(ctx, [cid, id], timeout);

            // Handle scheduling
            let cap = capabilities;
            if (!cap) {
                cap = DEFAULT_CAPABILITIES;
            }
            await scheduler.onPeerAdded(ctx, conf.id, id, await this.#getStreams(ctx, res, conf), cap, res.role!);

            // Notify state change
            this.notifyConferenceChanged(ctx, cid);
            return res;
        });
    }

    changeUserPeersRole = async (parent: Context, cid: number, uid: number, newRole: 'speaker' | 'listener') => {
        return await inTx(parent, async (ctx) => {
            let userPeers = await Store.ConferencePeer.user.findAll(ctx, cid, uid);
            let conf = await this.getOrCreateConference(ctx, cid);

            // Apply for all user peers
            for (let peer of userPeers) {

                if (!peer) {
                    throw Error('Unable to find peer');
                }
                if (!peer.enabled) {
                    return;
                }
                if (peer.role === newRole) {
                    return;
                }

                peer.role = newRole;
                await peer.flush(ctx);

                let scheduler = this.getScheduler(conf.currentScheduler);
                await scheduler.onPeerRoleChanged(ctx, cid, peer.id, newRole);
            }
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
            await scheduler.onPeerStreamsChanged(ctx, conf.id, peer.id, await this.#getStreams(ctx, peer, conf));

            // Notify state change
            this.notifyConferenceChanged(ctx, cid);
            return await this.getOrCreateConference(ctx, cid);
        });
    }

    conferenceRequestLocalMediaChange = async (parent: Context, cid: number, uid: number, tid: string, media: MediaSettings) => {
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
            await scheduler.onPeerStreamsChanged(ctx, conf.id, peer.id, await this.#getStreams(ctx, peer, conf));

            // Notify state change
            this.notifyConferenceChanged(ctx, cid);
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
            await scheduler.onPeerStreamsChanged(ctx, conf.id, peer.id, await this.#getStreams(ctx, peer, conf));

            // Notify state change
            this.notifyConferenceChanged(ctx, cid);
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
            await scheduler.onPeerStreamsChanged(ctx, conf.id, peer.id, await this.#getStreams(ctx, peer, conf));

            // Notify state change
            this.notifyConferenceChanged(ctx, peer.cid);
            return conf;
        });
    }

    //
    // Media streams update
    //
    updateMediaStreams = async (parent: Context, cid: number, uid: number, tid: string) => {
        return await inTx(parent, async ctx => {
            let conf = await this.getOrCreateConference(ctx, cid);
            let peer = await Store.ConferencePeer.auth.find(ctx, cid, uid, tid);
            if (!peer) {
                throw Error('Unable to find peer');
            }

            // Scheduling
            let scheduler = this.getScheduler(conf.currentScheduler);
            await scheduler.onPeerStreamsChanged(ctx, conf.id, peer.id, await this.#getStreams(ctx, peer, conf));

            // Notify state change
            this.notifyConferenceChanged(ctx, cid);
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
                await this.#doRemovePeer(ctx, m.id, false, false);
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

    removePeer = async (parent: Context, pid: number, byTimout = false) => {
        //
        // WARNING: Making multiple peer removal at the same transcation can yield different results!
        //
        return await this.#doRemovePeer(parent, pid, true, byTimout);
    }

    #doRemovePeer = async (parent: Context, pid: number, detectEnd: boolean, byTimout: boolean) => {
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
            this.notifyConferenceChanged(ctx, existing.cid);

            // Remove peer from voice chat
            if (byTimout) {
                let voiceConv = await Store.ConversationVoice.findById(ctx, existing.cid);
                if (voiceConv) {
                    let p = await Store.VoiceChatParticipant.findById(ctx, existing.cid, existing.uid);
                    if (p) {
                        await Modules.VoiceChats.participants.leaveChat(ctx, existing.cid, existing.uid);
                    }
                }
            }
        });
    }

    //
    // Keep Alive
    //

    peerKeepAlive = async (parent: Context, cid: number, pid: number, timeout: number) => {
        return await inTx(parent, async (ctx) => {
            this.keepAlive.keepAlive(ctx, [cid, pid], timeout);
            return true;
        });
    }

    getPeerKeepAlive = async (parent: Context, cid: number, pid: number) => {
        return await this.keepAlive.getLastSeen(parent, [cid, pid]);
    }

    checkTimeouts = async (parent: Context) => {
        let active = await inTx(parent, async ctx => await Store.ConferencePeer.active.findAll(ctx));
        for (let a of active) {
            try {
                await inTx(parent, async (ctx) => {
                    let peer = (await Store.ConferencePeer.findById(ctx, a.id))!;
                    if (peer.enabled && !(await this.keepAlive.isAlive(ctx, [peer.cid, peer.id]))) {
                        log.log(ctx, 'Call Participant Reaped: ' + a.uid + ' from ' + a.cid);
                        await this.removePeer(ctx, a.id, true);
                        // await this.bumpVersion(ctx, a.cid, a.id);
                    }
                });
            } catch (e) {
                log.log(parent, 'kick_error', e);
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
            Events.CallEnded.event(ctx, { duration: Date.now() - conf.startTime! });
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
            let [streamState, streamSeq] = await Promise.all([
                this.endStreamDirectory.getState(ctx, streamId),
                this.endStreamDirectory.getSeq(ctx, streamId)
            ]);
            if (!streamState || !streamSeq) {
                throw Error('Unable to find stream');
            }
            if (seq !== undefined && seq !== streamSeq) {
                return;
            }
            if (streamState !== 'need-offer') {
                return;
            }
            this.endStreamDirectory.updateStream(ctx, streamId, {
                localSdp: offer,
                state: 'wait-answer'
            });

            // Schedule
            await scheduler.onStreamOffer(ctx, peer.cid, peer.id, streamId, offer, hints ? hints : null);
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
            let [streamState, streamSeq] = await Promise.all([
                this.endStreamDirectory.getState(ctx, streamId),
                this.endStreamDirectory.getSeq(ctx, streamId)
            ]);
            if (!streamState || !streamSeq) {
                throw Error('Unable to find stream');
            }
            if (seq !== undefined && seq !== streamSeq) {
                return;
            }
            if (streamState !== 'need-answer') {
                return;
            }

            this.endStreamDirectory.updateStream(ctx, streamId, {
                localSdp: answer,
                state: 'online'
            });

            // Schedule
            await scheduler.onStreamAnswer(ctx, peer.cid, peer.id, streamId, answer);
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
            let [streamState, streamLocalCandidates] = await Promise.all([
                this.endStreamDirectory.getState(ctx, streamId),
                this.endStreamDirectory.getLocalCandidates(ctx, streamId)
            ]);
            if (!streamState || !streamLocalCandidates) {
                throw Error('Unable to find stream');
            }
            if (streamState === 'completed') {
                return;
            }
            if (streamLocalCandidates.find((v) => v === candidate)) {
                return;
            }
            this.endStreamDirectory.updateStream(ctx, streamId, {
                localCandidates: [...streamLocalCandidates, candidate]
            });

            // Scheduling
            await scheduler.onStreamCandidate(ctx, peer.cid, peer.id, streamId, candidate);
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
        });
    }

    //
    // Queries
    //

    findActiveMembers = async (parent: Context, cid: number) => {
        return await Store.ConferencePeer.conference.findAll(parent, cid);
    }

    getConferenceVersion = (ctx: Context, cid: number) => {
        return Store.ConferenceRoomVersion.get(ctx, cid);
    }

    notifyConferenceChanged = (ctx: Context, cid: number) => {
        Store.ConferenceRoomVersion.increment(ctx, cid);
        notifyFastWatch(ctx, 'conference-' + cid);
    }

    notifyPeerChanged = (ctx: Context, pid: number) => {
        Store.ConferencePeerVersion.increment(ctx, pid);
        notifyFastWatch(ctx, 'conference-peer-' + pid);
    }

    getPeerVersion = (ctx: Context, pid: number) => {
        return Store.ConferencePeerVersion.get(ctx, pid);
    }

    #getStreams = async (ctx: Context, peer: ConferencePeer, conference: ConferenceRoom): Promise<MediaSources> => {
        let voiceConv = await Store.ConversationVoice.findById(ctx, conference.id);
        if (voiceConv) {
            let part = await Store.VoiceChatParticipant.findById(ctx, conference.id, peer.uid);
            let audioStream = true;
            if (part && !VoiceChatParticipantStatus.isSpeaker(part)) {
                audioStream = false;
            }
            return {
                videoStream: false,
                screenCastStream: false,
                audioStream: audioStream
            };
        }

        return {
            videoStream: peer.videoPaused === false,
            screenCastStream: conference.screenSharingPeerId === peer.id,
            audioStream: true
        };
    }
}