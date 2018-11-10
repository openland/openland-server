import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';

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

    async roomMembersCount(conversationId: number, status?: string): Promise<number> {
        return (await this.entities.RoomParticipant.allFromActive(conversationId)).filter(m => status === undefined || m.status === status).length;
    }

    async addToChannel(channelId: number, uid: number) {
        let profile = await Modules.Users.profileById(uid);
        // no profile - user not signed up
        if (!profile) {
            return;
        }
        let firstName = profile!!.firstName;
        await inTx(async () => {
            let existing = await this.entities.RoomParticipant.findById(channelId, uid);
            if (existing) {
                if (existing.status === 'joined') {
                    return;
                } else {
                    existing.status = 'joined';
                }
            } else {
                await this.entities.RoomParticipant.create(channelId, uid, {
                    role: 'member',
                    status: 'joined',
                    invitedBy: uid
                }).then(async p => await p.flush());
            }
            await Modules.Messaging.sendMessage(channelId, uid, {
                message: `${firstName} has joined the channel!`,
                isService: true,
                isMuted: true,
                serviceMetadata: {
                    type: 'user_invite',
                    userIds: [uid],
                    invitedById: uid
                }
            });
        });
    }
}