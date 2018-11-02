import { AllEntities } from 'openland-module-db/schema';

export class RoomRepository {
    private readonly entities: AllEntities;
    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async isActiveMember(uid: number, cid: number) {
        let p = await this.entities.RoomParticipant.findById(cid, uid);
        if (!p) {
            return false;
        }
        if (p.status === 'joined') {
            return true;
        } else {
            return false;
        }
    }

    async findMembershipStatus(uid: number, cid: number) {
        let p = await this.entities.RoomParticipant.findById(cid, uid);
        if (!p) {
            return null;
        }
        return p;
    }

    async findActiveMembers(cid: number) {
        return this.entities.RoomParticipant.allFromActive(cid);
    }
}