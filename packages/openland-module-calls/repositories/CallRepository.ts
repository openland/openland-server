import { injectable, inject } from 'inversify';
import { AllEntities } from 'openland-module-db/schema';
import { Context } from 'openland-utils/Context';
import { inTx } from 'foundation-orm/inTx';
import { createLogger } from 'openland-log/createLogger';

let log = createLogger('call-repo');

@injectable()
export class CallRepository {

    @inject('FDB')
    entities!: AllEntities;

    getOrCreateConference = async (parent: Context, cid: number) => {
        return await inTx(parent, async (ctx) => {
            let conv = (await this.entities.Conversation.findById(ctx, cid))!;
            let strategy: 'direct' | 'bridged' = (!conv || conv.kind === 'private') ? 'direct' : 'bridged';
            let res = await this.entities.ConferenceRoom.findById(ctx, cid);
            if (!res) {
                res = await this.entities.ConferenceRoom.create(ctx, cid, { strategy });
            }
            return res;
        });
    }

    addPeer = async (parent: Context, cid: number, uid: number, tid: string, timeout: number) => {
        return await inTx(parent, async (ctx) => {

            // let room = await this.entities.ConferenceRoom.findById(ctx, cid);
            // if (!room) {
            //     throw Error('Unable to find room');
            // }

            // Disable existing for this auth
            let existing = await this.entities.ConferencePeer.findFromAuth(ctx, cid, uid, tid);
            if (existing) {
                await this.removePeer(ctx, existing.id);
            }

            // Create new peer
            let seq = (await this.entities.Sequence.findById(ctx, 'conference-peer-id'));
            if (!seq) {
                seq = await this.entities.Sequence.create(ctx, 'conference-peer-id', { value: 0 });
            }
            let id = ++seq.value;
            await seq.flush();
            let res = await this.entities.ConferencePeer.create(ctx, id, {
                cid, uid, tid,
                keepAliveTimeout: Date.now() + timeout,
                enabled: true
            });

            // Create connections
            let confPeers = await this.entities.ConferencePeer.allFromConference(ctx, cid);
            for (let cp of confPeers) {
                if (cp.id === id) {
                    continue;
                }
                await this.entities.ConferenceConnection.create(ctx, Math.min(cp.id, id), Math.max(cp.id, id), {
                    cid: cid,
                    state: 'wait-offer',
                    ice1: [],
                    ice2: []
                });
            }

            // Create streams
            for (let cp of confPeers) {
                if (cp.id === id) {
                    continue;
                }

                // if (room.strategy === 'direct') {
                await this.entities.ConferenceMediaStream.create(ctx, await this.nextStreamId(ctx), {
                    kind: 'direct',
                    peer1: Math.min(cp.id, id),
                    peer2: Math.max(cp.id, id),
                    cid: cid,
                    state: 'wait-offer',
                    ice1: [],
                    ice2: []
                });
                // }
            }

            await this.bumpVersion(ctx, cid);
            return res;
        });
    }

    removePeer = async (parent: Context, pid: number) => {
        await inTx(parent, async (ctx) => {

            // Disable peer itself
            let existing = await this.entities.ConferencePeer.findById(ctx, pid);
            if (!existing) {
                throw Error('Unable to find peer: ' + pid);
            }
            existing.enabled = false;

            // Kill all connections
            let connections = await this.entities.ConferenceConnection.allFromConference(ctx, existing.cid);
            for (let c of connections) {
                if (c.peer1 === pid || c.peer2 === pid) {
                    c.state = 'completed';
                }
            }

            // Kill all streams
            let streams = await this.entities.ConferenceMediaStream.allFromConference(ctx, existing.cid);
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
            let peer = await this.entities.ConferencePeer.findById(ctx, pid);
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
            let active = await this.entities.ConferencePeer.allFromActive(ctx);
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

    streamOffer = async (parent: Context, id: number, peerId: number, offer: string) => {
        await inTx(parent, async (ctx) => {
            let peer = await this.entities.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }

            let stream = await this.entities.ConferenceMediaStream.findById(ctx, id);
            if (!stream) {
                throw Error('Unable to find stream');
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

            await this.bumpVersion(ctx, stream!.cid);
        });
    }

    streamAnswer = async (parent: Context, id: number, peerId: number, answer: string) => {
        await inTx(parent, async (ctx) => {
            let peer = await this.entities.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }
            let stream = await this.entities.ConferenceMediaStream.findById(ctx, id);
            if (!stream) {
                throw Error('Unable to find stream');
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

            await this.bumpVersion(ctx, stream!.cid);
        });
    }

    streamCandidate = async (parent: Context, id: number, peerId: number, candidate: string) => {
        await inTx(parent, async (ctx) => {
            let peer = await this.entities.ConferencePeer.findById(ctx, peerId);
            if (!peer || !peer.enabled) {
                return;
            }
            let stream = await this.entities.ConferenceMediaStream.findById(ctx, id);
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

            await this.bumpVersion(ctx, stream!.cid);
        });
    }

    //
    // Connections
    //

    connectionOffer = async (parent: Context, cid: number, sourcePeerId: number, destPeerId: number, offer: string) => {
        await inTx(parent, async (ctx) => {
            let sourcePeer = await this.entities.ConferencePeer.findById(ctx, sourcePeerId);
            let destPeer = await this.entities.ConferencePeer.findById(ctx, destPeerId);
            if (!sourcePeer || !destPeer || !sourcePeer.enabled || !destPeer.enabled) {
                return;
            }
            // Offer can make only the peer that have lower ID
            if (sourcePeerId > destPeerId) {
                throw Error('Invalid peers: ' + sourcePeerId + ' and ' + destPeerId);
            }

            // Update connection
            let connection = await this.entities.ConferenceConnection.findById(ctx, sourcePeerId, destPeerId);
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
            let sourcePeer = await this.entities.ConferencePeer.findById(ctx, sourcePeerId);
            let destPeer = await this.entities.ConferencePeer.findById(ctx, destPeerId);
            if (!sourcePeer || !destPeer || !sourcePeer.enabled || !destPeer.enabled) {
                return;
            }
            // Offer can make only the peer that have lower ID
            if (sourcePeerId < destPeerId) {
                throw Error('Invalid peers');
            }

            // Update connection
            let connection = await this.entities.ConferenceConnection.findById(ctx, destPeerId, sourcePeerId);
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
            let sourcePeer = await this.entities.ConferencePeer.findById(ctx, sourcePeerId);
            let destPeer = await this.entities.ConferencePeer.findById(ctx, destPeerId);
            if (!sourcePeer || !destPeer || !sourcePeer.enabled || !destPeer.enabled) {
                return;
            }

            // Update connection
            let connection = await this.entities.ConferenceConnection.findById(ctx, Math.min(sourcePeerId, destPeerId), Math.max(sourcePeerId, destPeerId));
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
        return await this.entities.ConferencePeer.allFromConference(parent, cid);
    }

    private bumpVersion = async (parent: Context, cid: number) => {
        await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, cid);
            conf.markDirty();
        });
    }

    private nextStreamId = async (parent: Context) => {
        return await inTx(parent, async (ctx) => {
            let ex = await this.entities.Sequence.findById(ctx, 'media-stream-id');
            if (ex) {
                ex.value++;
                let res = ex.value;
                await ex.flush();
                return res;
            } else {
                await this.entities.Sequence.create(ctx, 'media-stream-id', { value: 1 });
                return 1;
            }
        });
    }
}