import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { RoomRepository } from 'openland-module-messaging/repositories/RoomRepository';
import { RoomProfileInput } from 'openland-module-messaging/RoomProfileInput';
import { inTx } from 'foundation-orm/inTx';
import { MessagingMediator } from './MessagingMediator';
import { AllEntities } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { DeliveryMediator } from './DeliveryMediator';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { UserError } from 'openland-errors/UserError';

@injectable()
export class RoomMediator {

    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('RoomRepository')
    private readonly repo!: RoomRepository;
    @lazyInject('MessagingMediator')
    private readonly messaging!: MessagingMediator;
    @lazyInject('DeliveryMediator')
    private readonly delivery!: DeliveryMediator;

    async isRoomMember(uid: number, cid: number) {
        return await this.repo.isActiveMember(uid, cid);
    }

    async createRoom(kind: 'public' | 'group', oid: number, uid: number, members: number[], profile: RoomProfileInput, message?: string) {
        return await inTx(async () => {
            // Create room
            let res = await this.repo.createRoom(kind, oid, uid, members, profile);
            // Send initial messages
            await this.messaging.sendMessage(uid, res.id, { message: kind === 'group' ? 'Group created' : 'Room created', isService: true });
            if (message) {
                await this.messaging.sendMessage(uid, res.id, { message: message });
            }
            return res;
        });
    }

    async joinRoom(cid: number, uid: number) {
        return await inTx(async () => {

            // Check Room
            let conv = await this.entities.ConversationRoom.findById(cid);
            if (!conv) {
                throw new NotFoundError();
            }
            if (conv.kind !== 'public') {
                throw new UserError('You can\'t join non-public room');
            }

            // Check if was kicked
            let participant = await this.entities.RoomParticipant.findById(cid, uid);
            if (participant && participant.status === 'kicked') {
                throw new UserError('You was kicked from this room');
            }

            // Join room
            if (await this.repo.joinRoom(cid, uid)) {
                // Send message
                let name = (await this.entities.UserProfile.findById(uid))!.firstName;
                await this.messaging.sendMessage(cid, uid, {
                    message: `${name} has joined the room!`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'user_invite',
                        userIds: [uid],
                        invitedById: uid
                    }
                });
            }

            return (await this.entities.Conversation.findById(cid))!;
        });
    }

    async inviteToRoom(cid: number, uid: number, invites: number[]) {
        return await inTx(async () => {

            if (invites.length > 0) {
                // Invite to room
                let res = (await Promise.all(invites.map(async (v) => {
                    if (await this.repo.addToRoom(cid, uid, v)) {
                        return v;
                    } else {
                        return null;
                    }
                }))).filter((v) => !!v).map((v) => v!);

                // Send message about joining the room
                if (res.length > 0) {
                    let users = res.map((v) => this.entities.UserProfile.findById(v));
                    await this.messaging.sendMessage(cid, uid, {
                        message: `${(await Promise.all(users)).map(u => u!.firstName).join(', ')} joined the room`,
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'user_invite',
                            userIds: invites,
                            invitedById: uid
                        }
                    });
                }
            }

            return (await this.entities.Conversation.findById(cid))!;
        });
    }

    async kickFromRoom(cid: number, uid: number, kickedUid: number) {
        return await inTx(async () => {
            if (uid === kickedUid) {
                throw Error('Unable to kick yourself');
            }

            // Permissions
            // TODO: Implement better
            let isSuperAdmin = (await Modules.Super.superRole(uid)) === 'super-admin';
            if (!isSuperAdmin && !(await this.repo.isActiveMember(cid, uid))) {
                throw Error('You are not member of a room');
            }
            let existingMembership = await this.repo.findMembershipStatus(kickedUid, cid);
            if (!existingMembership || existingMembership.status !== 'joined') {
                throw Error('User are not member of a room');
            }
            let canKick = isSuperAdmin || existingMembership.invitedBy === uid;
            if (!canKick) {
                throw Error('Insufficient rights');
            }

            // Kick from group
            if (await this.repo.kickFromRoom(cid, uid)) {

                // Send message
                let profile = (await this.entities.UserProfile.findById(kickedUid))!;
                await this.messaging.sendMessage(cid, uid, {
                    message: `${profile!.firstName} was kicked from the room`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'user_kick',
                        userId: kickedUid,
                        kickedById: uid
                    }
                });

                // Deliver dialog deletion
                await this.delivery.onDialogDelete(kickedUid, cid);
            }

            return (await this.entities.Conversation.findById(cid))!;
        });
    }

    async leaveRoom(cid: number, uid: number) {
        return await inTx(async () => {

            if (await this.repo.leaveRoom(cid, uid)) {
                // Send message
                let profile = await this.entities.UserProfile.findById(uid);
                await this.messaging.sendMessage(cid, uid, {
                    message: `${profile!.firstName} has left the room`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'user_kick',
                        userId: uid,
                        kickedById: uid
                    }
                });

                // Deliver dialog deletion
                await this.delivery.onDialogDelete(uid, cid);
            }

            return (await this.entities.Conversation.findById(cid))!;
        });
    }

    async updateRoomProfile(cid: number, uid: number, profile: Partial<RoomProfileInput>) {
        return await inTx(async () => {
            let conv = await this.entities.RoomProfile.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            // TODO: Check Access
            let res = await this.repo.updateRoomProfile(cid, profile);
            let roomProfile = (await this.entities.RoomProfile.findById(cid))!;
            if (res.updatedPhoto) {
                await this.messaging.sendMessage(cid, uid, {
                    message: `Updated room photo`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'photo_change',
                        picture: roomProfile.image
                    }
                });
            }
            if (res.updatedTitle) {
                await this.messaging.sendMessage(cid, uid, {
                    message: `Updated room name to "${res}"`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'title_change',
                        title: roomProfile.title
                    }
                });
            }

            return (await this.entities.Conversation.findById(cid))!;
        });
    }

    async updateMemberRole(cid: number, uid: number, updatedUid: number, role: 'admin' | 'owner' | 'member') {
        return await inTx(async () => {
            let p = await this.entities.RoomParticipant.findById(cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            let p2 = await this.entities.RoomParticipant.findById(cid, updatedUid);
            if (!p2 || p2.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            let canChangeRole = p.role === 'admin' || p.role === 'owner';

            if (!canChangeRole) {
                throw new AccessDeniedError();
            }
            return await this.repo.updateMemberRole(cid, uid, updatedUid, role);
        });
    }

    //
    // Queries
    //

    async resolvePrivateChat(uid1: number, uid2: number) {
        return await this.repo.resolvePrivateChat(uid1, uid2);
    }

    async resolveOrganizationChat(oid: number) {
        return await this.repo.resolveOrganizationChat(oid);
    }

    async findConversationMembers(cid: number): Promise<number[]> {
        return await this.repo.findConversationMembers(cid);
    }

    async resolveConversationTitle(conversationId: number, uid: number): Promise<string> {
        return await this.repo.resolveConversationTitle(conversationId, uid);
    }

    async resolveConversationPhoto(conversationId: number, uid: number): Promise<string | null> {
        return await this.repo.resolveConversationPhoto(conversationId, uid);
    }

    async checkAccess(uid: number, cid: number) {
        return await this.repo.checkAccess(uid, cid);
    }

    async setFeatured(cid: number, featued: boolean) {
        return await this.repo.setFeatured(cid, featued);
    }

    async setListed(cid: number, listed: boolean) {
        return await this.repo.setListed(cid, listed);
    }

    async roomMembersCount(conversationId: number, status?: string): Promise<number> {
        return await this.repo.roomMembersCount(conversationId, status);
    }

    async findMembershipStatus(uid: number, cid: number) {
        return await this.repo.findMembershipStatus(uid, cid);
    }
}