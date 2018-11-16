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
        return await this.entities.ConferenceParticipant.allFromConference(parent, cid);
    }

    conferenceJoin = async (parent: Context, cid: number, uid: number, tid: string, timeout: number) => {
        return await inTx(parent, async (ctx) => {
            let res = (await this.entities.ConferenceParticipant.findById(ctx, cid, uid, tid));
            if (res) {
                res.keepAliveTimeout = Date.now() + timeout;
                res.enabled = true;
                await this.bumpVersion(ctx, cid);
            } else {
                let seq = (await this.entities.Sequence.findById(ctx, 'conference-participant-id'));
                if (!seq) {
                    seq = await this.entities.Sequence.create(ctx, 'conference-participant-id', { value: 0 });
                }
                let id = ++seq.value;
                await seq.flush();
                res = await this.entities.ConferenceParticipant.create(ctx, cid, uid, tid, {
                    id,
                    keepAliveTimeout: Date.now() + timeout, enabled: true
                });
                await this.bumpVersion(ctx, cid);
            }
            return res;
        });
    }

    conferenceLeave = async (parent: Context, cid: number, uid: number, tid: string) => {
        await inTx(parent, async (ctx) => {
            let res = (await this.entities.ConferenceParticipant.findById(ctx, cid, uid, tid));
            if (res) {
                res.enabled = false;
            }
            await this.bumpVersion(ctx, cid);
        });
    }

    checkTimeouts = async (parent: Context) => {
        await inTx(parent, async (ctx) => {
            let active = await this.entities.ConferenceParticipant.allFromActive(ctx);
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