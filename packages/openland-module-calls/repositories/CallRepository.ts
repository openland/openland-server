import { GQL } from 'openland-module-api/schema/SchemaSpec';
import { lazyInject } from 'openland-modules/Modules.container';
import { CallSchedulerKitchen } from './CallSchedulerKitchen';
import { CallSchedulerMesh } from './CallSchedulerMesh';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { ConferencePeer, ConferenceRoom } from '../../openland-module-db/store';
import { CallScheduler, MediaSources } from './CallScheduler';
import { createHyperlogger } from '../../openland-module-hyperlog/createHyperlogEvent';

let log = createLogger('call-repo');

let callEndedEvent = createHyperlogger<{ duration: number }>('call_ended');

@injectable()
export class CallRepository {

    readonly defaultScheduler: 'mesh' | 'mesh-no-relay' | 'basic-sfu' = 'mesh-no-relay';
    readonly schedulerMesh = new CallSchedulerMesh('relay');
    readonly schedulerMeshNoRelay = new CallSchedulerMesh('all');

    @lazyInject('CallSchedulerKitchen')
    readonly schedulerKitchen!: CallSchedulerKitchen;

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
        } else if (kind === 'basic-sfu') {
            return this.schedulerKitchen;
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
                    conf.currentScheduler = this.defaultScheduler; // Default Scheduler
                }

                // Flush for better correctness
                await conf.flush(ctx);

                justStarted = true;
            }

            // Resolve scheduler
            let scheduler = this.getScheduler(conf.currentScheduler);

            // Detect call start
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
            });

            // Handle scheduling
            await scheduler.onPeerAdded(ctx, conf.id, id, this.#getStreams(res, conf));

            // Notify state change
            await this.bumpVersion(ctx, cid);
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
            await this.bumpVersion(ctx, cid);
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
            await this.bumpVersion(ctx, cid);
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
            await this.bumpVersion(ctx, peer.cid);
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
                await scheduler.onConferenceStopped(ctx, cid);
                if (conf.startTime) {
                    await callEndedEvent.event(ctx, { duration: Date.now() - conf.startTime });
                }
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

            // Handle media scheduling
            let conf = await this.getOrCreateConference(ctx, existing.cid);
            let scheduler = this.getScheduler(conf.currentScheduler);

            // Handle Peer removal
            await scheduler.onPeerRemoved(ctx, conf.id, pid);

            // Detect call end
            if (detectEnd) {
                if ((await Store.ConferencePeer.active.findAll(ctx)).length === 0) {
                    await scheduler.onConferenceStopped(ctx, existing.cid);
                }
            }

            // Notify state change
            await this.bumpVersion(ctx, existing.cid);
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

    //
    // Streams
    //

    streamOffer = async (
        parent: Context,
        streamId: string,
        peerId: number,
        offer: string,
        seq: number | null | undefined,
        hints: GQL.MediaStreamHint[] | null | undefined
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
            await scheduler.onStreamOffer(ctx, peer.cid, peer.id, streamId, offer, hints);
            await stream.flush(ctx);

            // Notify state change
            await this.bumpVersion(ctx, peer.cid);
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
            await this.bumpVersion(ctx, peer.cid);
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
            await this.bumpVersion(ctx, peer.cid);
        });
    }

    //
    // Queries
    //

    findActiveMembers = async (parent: Context, cid: number) => {
        return await Store.ConferencePeer.conference.findAll(parent, cid);
    }

    bumpVersion = async (parent: Context, cid: number) => {
        await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, cid);
            conf.invalidate();
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