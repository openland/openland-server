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

    findConference = async (parent: Context, cid: number) => {
        return await inTx(parent, async (ctx) => {
            let res = await this.entities.ConferenceRoom.findById(ctx, cid);
            if (!res) {
                res = await this.entities.ConferenceRoom.create(ctx, cid, {});
            }
            return res;
        });
    }

    findActiveMembers = async (parent: Context, cid: number) => {
        return await this.entities.ConferencePeer.allFromConference(parent, cid);
    }

    conferenceJoin = async (parent: Context, cid: number, uid: number, tid: string, timeout: number) => {
        return await inTx(parent, async (ctx) => {
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
            await this.bumpVersion(ctx, cid);
            return res;
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
                res.enabled = false;
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
                    a.enabled = false;
                    await this.bumpVersion(ctx, a.cid);
                }
            }
        });
    }

    private bumpVersion = async (parent: Context, cid: number) => {
        await inTx(parent, async (ctx) => {
            let conf = await this.findConference(ctx, cid);
            conf.markDirty();
        });
    }
}