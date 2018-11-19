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
            let res = await this.entities.ConferenceRoom.findById(ctx, cid);
            if (!res) {
                res = await this.entities.ConferenceRoom.create(ctx, cid, {});
            }
            return res;
        });
    }

    addNewPeer = async (parent: Context, cid: number, uid: number, tid: string, timeout: number) => {
        return await inTx(parent, async (ctx) => {

            // Disable existing for this auth
            let existing = await this.entities.ConferencePeer.findFromAuth(ctx, cid, uid, tid);
            if (existing) {
                await this.disablePeer(ctx, existing.id);
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
            await this.bumpVersion(ctx, cid);
            return res;
        });
    }

    disablePeer = async (parent: Context, pid: number) => {
        await inTx(parent, async (ctx) => {

            // Disable peer itself
            let existing = await this.entities.ConferencePeer.findById(ctx, pid);
            if (existing) {
                existing.enabled = false;
            }

            // TODO: Disable connections
        });
    }

    conferenceJoin = async (parent: Context, cid: number, uid: number, tid: string, timeout: number) => {
        return await inTx(parent, async (ctx) => {

            // Disable existing for this auth
            let existing = await this.entities.ConferencePeer.findFromAuth(ctx, cid, uid, tid);
            if (existing) {
                await this.disablePeer(ctx, existing.id);
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

            await this.bumpVersion(ctx, cid);
            return res;
        });
    }

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

    peerConnectionCandidate = async (parent: Context, cid: number, sourcePeerId: number, destPeerId: number, candidate: string) => {
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

    conferenceKeepAlive = async (parent: Context, cid: number, pid: number, timeout: number) => {
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

    conferenceLeave = async (parent: Context, cid: number, pid: number) => {
        await inTx(parent, async (ctx) => {
            let res = (await this.entities.ConferencePeer.findById(ctx, pid));
            if (res) {
                if (res.cid !== cid) {
                    throw Error('Conference id mismatch');
                }
                await this.disablePeer(ctx, res.id);
                await this.bumpVersion(ctx, res.cid);
            }
        });
    }

    checkTimeouts = async (parent: Context) => {
        await inTx(parent, async (ctx) => {
            let active = await this.entities.ConferencePeer.allFromActive(ctx);
            let now = Date.now();
            for (let a of active) {
                if (a.keepAliveTimeout < now) {
                    log.log(ctx, 'Call Participant Reaped: ' + a.uid + ' from ' + a.cid);
                    await this.disablePeer(ctx, a.id);
                    await this.bumpVersion(ctx, a.cid);
                }
            }
        });
    }

    findActiveMembers = async (parent: Context, cid: number) => {
        return await this.entities.ConferencePeer.allFromConference(parent, cid);
    }

    private bumpVersion = async (parent: Context, cid: number) => {
        await inTx(parent, async (ctx) => {
            let conf = await this.getOrCreateConference(ctx, cid);
            conf.markDirty();
        });
    }
}