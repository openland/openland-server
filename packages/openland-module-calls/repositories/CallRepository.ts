import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { ConferenceMediaStreamCreateShape } from '../../openland-module-db/store';

let log = createLogger('call-repo');

function resolveMediaStreamSettings(uid1: number, uid2: number, confKind: 'mash' | 'stream', streamerId: number | null): ConferenceMediaStreamCreateShape['settings1'] {
    if (confKind === 'mash') {
        return {
            audioIn: true,
            audioOut: true,
            videoIn: true,
            videoOut: true,
            iceTransportPolicy: 'relay'
        };
    }

    let settings = {
        audioIn: false,
        audioOut: false,
        videoIn: false,
        videoOut: false,
        iceTransportPolicy: undefined
    };
    if (uid1 === streamerId) {
        settings.audioOut = true;
        settings.videoOut = true;
    } else if (uid2 === streamerId) {
        settings.videoIn = true;
        settings.audioIn = true;
    }

    return settings;
}

@injectable()
export class CallRepository {

    getOrCreateConference = async (parent: Context, cid: number) => {
        return await inTx(parent, async (ctx) => {
            let conv = (await Store.Conversation.findById(ctx, cid))!;
            let strategy: 'direct' | 'bridged' = (!conv || conv.kind === 'private') ? 'direct' : 'bridged';
            let res = await Store.ConferenceRoom.findById(ctx, cid);
            if (!res) {
                res = await Store.ConferenceRoom.create(ctx, cid, { strategy, startTime: null });
            }
            return res;
        });
    }

    addPeer = async (parent: Context, cid: number, uid: number, tid: string, timeout: number, strategy?: 'mash' | 'stream' | null) => {
        return await inTx(parent, async (ctx) => {

            // let room = await this.entities.ConferenceRoom.findById(ctx, cid);
            // if (!room) {
            //     throw Error('Unable to find room');
            // }

            // bump startTime if its initiator of call
            let confPeers = await Store.ConferencePeer.conference.findAll(ctx, cid);
            let conf = await this.getOrCreateConference(ctx, cid);
            if (confPeers.length === 0) {
                conf.startTime = Date.now();
                conf.kind = strategy || 'mash';
                conf.streamerId = conf.kind === 'stream' ? uid : null;
                await conf.flush(ctx);
            }

            // Disable existing for this auth
            let existing = await Store.ConferencePeer.auth.find(ctx, cid, uid, tid);
            if (existing) {
                await this.removePeer(ctx, existing.id);
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
                enabled: true
            });

            // Create connections
            for (let cp of confPeers) {
                if (cp.id === id) {
                    continue;
                }
                await Store.ConferenceConnection.create(ctx, Math.min(cp.id, id), Math.max(cp.id, id), {
                    cid: cid,
                    state: 'wait-offer',
                    ice1: [],
                    ice2: [],
                    offer: null,
                    answer: null
                });
            }

            // Create streams
            for (let cp of confPeers) {
                if (cp.id === id) {
                    continue;
                }

                let settings1: any;
                let settings2: any;
                if (cp.id < id) {
                    settings1 = resolveMediaStreamSettings(cp.uid, uid, conf.kind!, conf.streamerId);
                    settings2 = resolveMediaStreamSettings(uid, cp.uid, conf.kind!, conf.streamerId);
                } else {
                    settings1 = resolveMediaStreamSettings(uid, cp.uid, conf.kind!, conf.streamerId);
                    settings2 = resolveMediaStreamSettings(cp.uid, uid, conf.kind!, conf.streamerId);
                }

                // if (room.strategy === 'direct') {
                await Store.ConferenceMediaStream.create(ctx, await this.nextStreamId(ctx), {
                    kind: 'direct',
                    peer1: Math.min(cp.id, id),
                    peer2: Math.max(cp.id, id),
                    cid: cid,
                    state: 'wait-offer',
                    ice1: [],
                    ice2: [],
                    offer: null,
                    answer: null,
                    settings1,
                    settings2,
                    seq: 0,
                });
                // }
            }

            await this.bumpVersion(ctx, cid);
            return res;
        });
    }

    endConference = async (parent: Context, cid: number) => {
        await inTx(parent, async (ctx) => {
            let members = await this.findActiveMembers(ctx, cid);
            for (let m of members) {
                await this.removePeer(ctx, m.id);
            }
        });
    }

    removePeer = async (parent: Context, pid: number) => {
        await inTx(parent, async (ctx) => {

            // Disable peer itself
            let existing = await Store.ConferencePeer.findById(ctx, pid);
            if (!existing) {
                throw Error('Unable to find peer: ' + pid);
            }
            existing.enabled = false;
            await existing.flush(ctx);

            // Kill all connections
            let connections = await Store.ConferenceConnection.conference.findAll(ctx, existing.cid);
            for (let c of connections) {
                if (c.peer1 === pid || c.peer2 === pid) {
                    c.state = 'completed';
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
    // Connections
    //

    connectionOffer = async (parent: Context, cid: number, sourcePeerId: number, destPeerId: number, offer: string) => {
        await inTx(parent, async (ctx) => {
            let sourcePeer = await Store.ConferencePeer.findById(ctx, sourcePeerId);
            let destPeer = await Store.ConferencePeer.findById(ctx, destPeerId);
            if (!sourcePeer || !destPeer || !sourcePeer.enabled || !destPeer.enabled) {
                return;
            }
            // Offer can make only the peer that have lower ID
            if (sourcePeerId > destPeerId) {
                throw Error('Invalid peers: ' + sourcePeerId + ' and ' + destPeerId);
            }

            // Update connection
            let connection = await Store.ConferenceConnection.findById(ctx, sourcePeerId, destPeerId);
            if (!connection) {
                return;
            }
            if (connection.state === 'wait-offer') {
                connection.offer = offer;
                connection.state = 'wait-answer';
            }

            // Notify about changes
            await this.bumpVersion(ctx, cid);
        });
    }

    connectionAnswer = async (parent: Context, cid: number, sourcePeerId: number, destPeerId: number, answer: string) => {
        await inTx(parent, async (ctx) => {
            let sourcePeer = await Store.ConferencePeer.findById(ctx, sourcePeerId);
            let destPeer = await Store.ConferencePeer.findById(ctx, destPeerId);
            if (!sourcePeer || !destPeer || !sourcePeer.enabled || !destPeer.enabled) {
                return;
            }
            // Offer can make only the peer that have lower ID
            if (sourcePeerId < destPeerId) {
                throw Error('Invalid peers');
            }

            // Update connection
            let connection = await Store.ConferenceConnection.findById(ctx, destPeerId, sourcePeerId);
            if (!connection) {
                return;
            }
            if (connection.state === 'wait-answer') {
                connection.answer = answer;
                connection.state = 'online';
            }

            // Notify about changes
            await this.bumpVersion(ctx, cid);
        });
    }

    connectionCandidate = async (parent: Context, cid: number, sourcePeerId: number, destPeerId: number, candidate: string) => {
        await inTx(parent, async (ctx) => {
            let sourcePeer = await Store.ConferencePeer.findById(ctx, sourcePeerId);
            let destPeer = await Store.ConferencePeer.findById(ctx, destPeerId);
            if (!sourcePeer || !destPeer || !sourcePeer.enabled || !destPeer.enabled) {
                return;
            }

            // Update connection
            let connection = await Store.ConferenceConnection.findById(ctx, Math.min(sourcePeerId, destPeerId), Math.max(sourcePeerId, destPeerId));
            if (!connection) {
                return;
            }
            if (sourcePeerId < destPeerId) {
                connection.ice1 = [...connection.ice1, candidate];
            } else {
                connection.ice2 = [...connection.ice1, candidate];
            }

            // Notify about changes
            await this.bumpVersion(ctx, cid);
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