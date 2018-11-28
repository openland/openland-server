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
import { Context } from 'openland-utils/Context';

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

    async isRoomMember(ctx: Context, uid: number, cid: number) {
        return await this.repo.isActiveMember(ctx, uid, cid);
    }

    async createRoom(parent: Context, kind: 'public' | 'group', oid: number, uid: number, members: number[], profile: RoomProfileInput, message?: string, listed?: boolean) {
        return await inTx(parent, async (ctx) => {
            // Create room
            let res = await this.repo.createRoom(ctx, kind, oid, uid, members, profile, listed);
            // Send initial messages
            await this.messaging.sendMessage(ctx, uid, res.id, { message: kind === 'group' ? 'Group created' : 'Room created', isService: true });
            if (message) {
                await this.messaging.sendMessage(ctx, uid, res.id, { message: message });
            }
            return res;
        });
    }

    async joinRoom(parent: Context, cid: number, uid: number, request?: boolean) {
        return await inTx(parent, async (ctx) => {

            // Check Room
            let conv = await this.entities.ConversationRoom.findById(ctx, cid);
            if (!conv) {
                throw new NotFoundError();
            }
            if (conv.kind !== 'public') {
                throw new UserError('You can\'t join non-public room');
            }

            // Check if was kicked
            let participant = await this.entities.RoomParticipant.findById(ctx, cid, uid);
            if (participant && participant.status === 'kicked') {
                throw new UserError('You was kicked from this room');
            }

            // Join room
            if (await this.repo.joinRoom(ctx, cid, uid, request) && !request) {
                // Send message
                let name = (await this.entities.UserProfile.findById(ctx, uid))!.firstName;
                await this.messaging.sendMessage(ctx, uid, cid, {
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

            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async inviteToRoom(parent: Context, cid: number, uid: number, invites: number[]) {
        return await inTx(parent, async (ctx) => {

            if (invites.length > 0) {
                // Invite to room
                let res = (await Promise.all(invites.map(async (v) => {
                    if (await this.repo.addToRoom(ctx, cid, v, uid)) {
                        return v;
                    } else {
                        return null;
                    }
                }))).filter((v) => !!v).map((v) => v!);

                // Send message about joining the room
                if (res.length > 0) {
                    let users = res.map((v) => this.entities.UserProfile.findById(ctx, v));
                    await this.messaging.sendMessage(ctx, uid, cid, {
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

            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async kickFromRoom(parent: Context, cid: number, uid: number, kickedUid: number) {
        return await inTx(parent, async (ctx) => {
            if (uid === kickedUid) {
                throw new UserError('Unable to kick yourself');
            }

            // Permissions
            // TODO: Implement better
            let isSuperAdmin = (await Modules.Super.superRole(ctx, uid)) === 'super-admin';
            if (!isSuperAdmin && !(await this.repo.isActiveMember(ctx, uid, cid))) {
                throw new UserError('You are not member of a room');
            }
            let existingMembership = await this.repo.findMembershipStatus(ctx, kickedUid, cid);
            if (!existingMembership || existingMembership.status !== 'joined') {
                throw new UserError('User are not member of a room');
            }
            let kickerRole = await this.repo.resolveUserRole(ctx, uid, cid);
            let canKick = isSuperAdmin || existingMembership.invitedBy === uid || (kickerRole === 'owner' || kickerRole === 'admin');
            if (!canKick) {
                throw new UserError('Insufficient rights');
            }

            // Kick from group
            if (await this.repo.kickFromRoom(ctx, cid, kickedUid)) {

                // Send message
                let profile = (await this.entities.UserProfile.findById(ctx, kickedUid))!;
                await this.messaging.sendMessage(ctx, uid, cid, {
                    message: `${profile!.firstName} was kicked from the room`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'user_kick',
                        userId: kickedUid,
                        kickedById: uid
                    }
                }, true);

                // Deliver dialog deletion
                await this.delivery.onDialogDelete(ctx, kickedUid, cid);
            }

            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async declineJoinRoomRequest(parent: Context, cid: number, by: number, requestedUid: number) {
        return await inTx(parent, async (ctx) => {
            // Permissions
            // TODO: Implement better
            let isSuperAdmin = (await Modules.Super.superRole(ctx, by)) === 'super-admin';
            if (!isSuperAdmin && !(await this.repo.isActiveMember(ctx, by, cid))) {
                throw new UserError('You are not member of a room');
            }
            let existingMembership = await this.repo.findMembershipStatus(ctx, requestedUid, cid);
            if (!existingMembership || existingMembership.status !== 'requested') {
                throw new UserError('User are not in requested status');
            }
            let kickerRole = await this.repo.resolveUserRole(ctx, by, cid);
            let canKick = isSuperAdmin || kickerRole === 'owner' || kickerRole === 'admin';
            if (!canKick) {
                throw new UserError('Insufficient rights');
            }

            // decline request
            await this.repo.declineJoinRoomRequest(ctx, cid, requestedUid);

            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async leaveRoom(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {

            if (await this.repo.leaveRoom(ctx, cid, uid)) {
                console.log('exited');

                // Send message
                let profile = await this.entities.UserProfile.findById(ctx, uid);
                await this.messaging.sendMessage(ctx, uid, cid, {
                    message: `${profile!.firstName} has left the room`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'user_kick',
                        userId: uid,
                        kickedById: uid
                    }
                }, true);

                // Deliver dialog deletion
                await this.delivery.onDialogDelete(ctx, uid, cid);
            }

            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async updateRoomProfile(parent: Context, cid: number, uid: number, profile: Partial<RoomProfileInput>) {
        return await inTx(parent, async (ctx) => {
            let conv = await this.entities.RoomProfile.findById(ctx, cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            // TODO: Check Access
            let res = await this.repo.updateRoomProfile(ctx, cid, profile);
            let roomProfile = (await this.entities.RoomProfile.findById(ctx, cid))!;
            if (res.updatedPhoto) {
                await this.messaging.sendMessage(ctx, uid, cid, {
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
                await this.messaging.sendMessage(ctx, uid, cid, {
                    message: `Updated room name to "${roomProfile.title}"`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'title_change',
                        title: roomProfile.title
                    }
                });
            }

            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async updateMemberRole(parent: Context, cid: number, uid: number, updatedUid: number, role: 'admin' | 'owner' | 'member') {
        return await inTx(parent, async (ctx) => {
            let p = await this.entities.RoomParticipant.findById(ctx, cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            let p2 = await this.entities.RoomParticipant.findById(ctx, cid, updatedUid);
            if (!p2 || p2.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            let canChangeRole = p.role === 'admin' || p.role === 'owner';

            if (!canChangeRole) {
                throw new AccessDeniedError();
            }
            return await this.repo.updateMemberRole(ctx, cid, uid, updatedUid, role);
        });
    }

    //
    // Queries
    //

    async resolvePrivateChat(ctx: Context, uid1: number, uid2: number) {
        return await this.repo.resolvePrivateChat(ctx, uid1, uid2);
    }

    async resolveOrganizationChat(ctx: Context, oid: number) {
        return await this.repo.resolveOrganizationChat(ctx, oid);
    }

    async findConversationMembers(ctx: Context, cid: number): Promise<number[]> {
        return await this.repo.findConversationMembers(ctx, cid);
    }

    async resolveConversationTitle(ctx: Context, conversationId: number, uid: number): Promise<string> {
        return await this.repo.resolveConversationTitle(ctx, conversationId, uid);
    }

    async resolveConversationPhoto(ctx: Context, conversationId: number, uid: number): Promise<string | null> {
        return await this.repo.resolveConversationPhoto(ctx, conversationId, uid);
    }

    async resolveConversationSocialImage(ctx: Context, conversationId: number): Promise<string | null> {
        return await this.repo.resolveConversationSocialImage(ctx, conversationId);
    }

    async resolveConversationOrganization(ctx: Context, cid: number) {
        return await this.repo.resolveConversationOrganization(ctx, cid);
    }

    async checkAccess(ctx: Context, uid: number, cid: number) {
        return await this.repo.checkAccess(ctx, uid, cid);
    }

    async setFeatured(ctx: Context, cid: number, featued: boolean) {
        return await this.repo.setFeatured(ctx, cid, featued);
    }

    async setListed(ctx: Context, cid: number, listed: boolean) {
        return await this.repo.setListed(ctx, cid, listed);
    }

    async roomMembersCount(ctx: Context, conversationId: number, status?: string): Promise<number> {
        return await this.repo.roomMembersCount(ctx, conversationId, status);
    }

    async findMembershipStatus(ctx: Context, uid: number, cid: number) {
        return await this.repo.findMembershipStatus(ctx, uid, cid);
    }

    async resolveUserMembershipStatus(ctx: Context, uid: number, cid: number) {
        return await this.repo.resolveUserMembershipStatus(ctx, uid, cid);
    }

    async resolveUserRole(ctx: Context, uid: number, cid: number) {
        return await this.repo.resolveUserRole(ctx, uid, cid);
    }

    async resolveRequests(ctx: Context, uid: number, cid: number) {
        let role = await Modules.Messaging.room.resolveUserRole(ctx, uid, cid);
        let isSuperAdmin = (await Modules.Super.superRole(ctx, uid)) === 'super-admin';
        if (role === 'admin' || role === 'owner' || isSuperAdmin) {
            return await this.entities.RoomParticipant.allFromRequests(ctx, cid);
        }
        return null;
    }

}