import { injectable, inject } from 'inversify';
import { AllEntities } from 'openland-module-db/schema';
import { Context } from 'openland-utils/Context';
import { inTx } from 'foundation-orm/inTx';

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
        let res = await this.entities.ConferenceRoomParticipant.allFromConference(parent, cid);
        let dt = Date.now();
        res = res.filter((v) => v.keepAliveTimeout > dt);
        let res2 = res.map((v) => v.uid);
        let res3: number[] = [];
        for (let r of res2) {
            if (!res3.find((v) => v === r)) {
                res3.push(r);
            }
        }
        return res3;
    }

    conferenceJoin = async (parent: Context, cid: number, uid: number, tid: string, timeout: number) => {
        return await inTx(parent, async (ctx) => {
            let res = (await this.entities.ConferenceRoomParticipant.findById(ctx, cid, uid, tid));
            if (res) {
                res.keepAliveTimeout = Date.now() + timeout;
                res.enabled = true;
            } else {
                res = await this.entities.ConferenceRoomParticipant.create(ctx, cid, uid, tid, {
                    keepAliveTimeout: Date.now() + timeout, enabled: true
                });
            }
            return res;
        });
    }

    conferenceLeave = async (parent: Context, cid: number, uid: number, tid: string) => {
        await inTx(parent, async (ctx) => {
            let res = (await this.entities.ConferenceRoomParticipant.findById(ctx, cid, uid, tid));
            if (res) {
                res.enabled = false;
            }
        });
    }
}