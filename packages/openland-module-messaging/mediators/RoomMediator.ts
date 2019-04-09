import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { RoomRepository, WelcomeMessageT } from 'openland-module-messaging/repositories/RoomRepository';
import { RoomProfileInput } from 'openland-module-messaging/RoomProfileInput';
import { inTx } from 'foundation-orm/inTx';
import { MessagingMediator } from './MessagingMediator';
import { AllEntities, ConversationRoom } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { DeliveryMediator } from './DeliveryMediator';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { UserError } from 'openland-errors/UserError';
import { Context } from 'openland-utils/Context';
import { MessageInput } from '../MessageInput';
import { boldString, buildMessage, userMention, usersMention } from '../../openland-utils/MessageBuilder';

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

    async createRoom(parent: Context, kind: 'public' | 'group', oid: number, uid: number, members: number[], profile: RoomProfileInput, message?: string, listed?: boolean, channel?: boolean) {
        return await inTx(parent, async (ctx) => {
            if (oid) {
                let isMember = await Modules.Orgs.isUserMember(ctx, uid, oid);
                let isSuperAdmin = (await Modules.Super.superRole(ctx, uid)) === 'super-admin';

                if (!isMember && !isSuperAdmin) {
                    throw new AccessDeniedError();
                }
            }
            // Create room
            let res = await this.repo.createRoom(ctx, kind, oid, uid, members, profile, listed, channel);
            // Send initial messages
            let userName = await Modules.Users.getUserFullName(parent, uid);
            let chatTypeString = channel ? 'channel' : 'group';
            await this.messaging.sendMessage(ctx, uid, res.id, {
                ...buildMessage(userMention(userName, uid), ` created the ${chatTypeString} `, boldString(profile.title)),
                isService: true,
            });
            if (message) {
                await this.messaging.sendMessage(ctx, uid, res.id, { message: message });
            }
            return res;
        });
    }

    async joinRoom(parent: Context, cid: number, uid: number, request?: boolean, invited?: boolean) {
        return await inTx(parent, async (ctx) => {

            // Check Room
            let conv = await this.entities.ConversationRoom.findById(ctx, cid);
            if (!conv) {
                throw new NotFoundError();
            }

            let isPublic = conv.kind === 'public' && (conv.oid && (await this.entities.Organization.findById(ctx, conv.oid))!.kind === 'community');
            let isMemberOfOrg = (conv.oid && await Modules.Orgs.isUserMember(ctx, uid, conv.oid)) || false;
            if (!isPublic && !invited && !isMemberOfOrg) {
                throw new UserError('You can\'t join non-public room');
            }

            // Any one can join public rooms from community
            // Member of org can join any rooms
            if (isPublic || isMemberOfOrg) {
                request = false;
            }

            // Check if was kicked
            let participant = await this.entities.RoomParticipant.findById(ctx, cid, uid);
            if (participant && participant.status === 'kicked' && !request) {
                throw new UserError(`Unfortunately, you cannot join ${await this.resolveConversationTitle(ctx, cid, uid)}. Someone kicked you from this group, and now you can only join it if a group member adds you.`, 'CANT_JOIN_GROUP');
            }

            // Join room
            if (await this.repo.joinRoom(ctx, cid, uid, request) && !request) {

                // let prevMessage = await Modules.Messaging.findTopMessage(ctx, cid);
                //
                // if (prevMessage && prevMessage.serviceMetadata && prevMessage.serviceMetadata.type === 'user_invite') {
                //     let uids: number[] = prevMessage.serviceMetadata.userIds;
                //     uids.push(uid);
                //
                //     await this.messaging.editMessage(ctx, prevMessage.id, prevMessage.uid, await this.roomJoinMessage(ctx, conv, uid, uids), false);
                // } else {
                //     await this.messaging.sendMessage(ctx, uid, cid, await this.roomJoinMessage(ctx, conv, uid, [uid]));
                // }
                let shouldSendJoinMessage = !conv.isChannel;
                if (shouldSendJoinMessage) {
                    await this.messaging.sendMessage(ctx, uid, cid, await this.roomJoinMessage(ctx, conv, uid, [uid], invited ? null : uid));
                } else {
                    // message not sent to new members, move room up in dialog list other way
                    await this.messaging.bumpDialog(ctx, uid, cid);
                }

            }

            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async inviteToRoom(parent: Context, cid: number, uid: number, invites: number[]) {
        return await inTx(parent, async (ctx) => {
            let conv = await this.entities.ConversationRoom.findById(ctx, cid);
            if (!conv) {
                throw new NotFoundError();
            }

            if (invites.length > 0) {
                // Invite to room
                let res: number[] = [];
                for (let id of invites) {
                    if (await this.repo.addToRoom(ctx, cid, id, uid)) {
                        res.push(id);
                    }
                }

                // Send message about joining the room
                if (res.length > 0) {

                    // let prevMessage = await Modules.Messaging.findTopMessage(ctx, cid);
                    //
                    // if (prevMessage && prevMessage.serviceMetadata && prevMessage.serviceMetadata.type === 'user_invite') {
                    //     let uids: number[] = prevMessage.serviceMetadata.userIds;
                    //     uids.push(...res);
                    //
                    //     await this.messaging.editMessage(ctx, prevMessage.id, prevMessage.uid, await this.roomJoinMessage(ctx, conv, uid, uids), false);
                    // } else {
                    //     await this.messaging.sendMessage(ctx, uid, cid, await this.roomJoinMessage(ctx, conv, uid, res));
                    // }
                    let shouldSendJoinMessage = !conv.isChannel;
                    if (shouldSendJoinMessage) {
                        await this.messaging.sendMessage(ctx, uid, cid, await this.roomJoinMessage(ctx, conv, uid, res, uid));
                    } else {
                        // message not sent to new members, move room up in dialog list other way
                        for (let u of res) {
                            await this.messaging.bumpDialog(ctx, u, cid);
                        }
                    }
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

            let conv = await this.entities.ConversationRoom.findById(ctx, cid);
            if (!conv) {
                throw new NotFoundError();
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

            let canKick = await this.canKickFromRoom(ctx, cid, uid, kickedUid);
            if (!canKick) {
                throw new UserError('Insufficient rights');
            }

            // Kick from group
            if (await this.repo.kickFromRoom(ctx, cid, kickedUid)) {
                if (!conv.isChannel) {
                    // Send message
                    let cickerName = await Modules.Users.getUserFullName(parent, uid);
                    let cickedName = await Modules.Users.getUserFullName(parent, kickedUid);
                    await this.messaging.sendMessage(ctx, uid, cid, {
                        ...buildMessage(userMention(cickerName, uid), ' kicked ', userMention(cickedName, kickedUid)),
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'user_kick',
                            userId: kickedUid,
                            kickedById: uid
                        },
                    }, true);
                }

                // Deliver dialog deletion
                await this.delivery.onDialogDelete(ctx, kickedUid, cid);
            }

            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async canKickFromRoom(parent: Context, cid: number, uid: number, kickedUid: number) {
        return await inTx(parent, async (ctx) => {
            let canKick = false;

            let conv = await this.entities.ConversationRoom.findById(ctx, cid);
            if (!conv) {
                return false;
            }

            let isSuperAdmin = (await Modules.Super.superRole(ctx, uid)) === 'super-admin';
            let existingMembership = await this.repo.findMembershipStatus(ctx, kickedUid, cid);
            if (!existingMembership || existingMembership.status !== 'joined') {
                return false;
            }

            if (isSuperAdmin) {
                canKick = true;
            }
            if (existingMembership.invitedBy === uid) {
                canKick = true;
            } else if (conv.oid && await Modules.Orgs.isUserOwner(ctx, uid, conv.oid)) {
                canKick = true;
            } else if (conv.ownerId === uid && (conv.oid ? !await Modules.Orgs.isUserOwner(ctx, kickedUid, conv.oid) : true)) {
                canKick = true;
            } else if (conv.oid && await Modules.Orgs.isUserAdmin(ctx, uid, conv.oid) && !await Modules.Orgs.isUserOwner(ctx, kickedUid, conv.oid) && conv.ownerId !== kickedUid) {
                canKick = true;
            }

            return canKick;
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
                // Send message
                let userName = await Modules.Users.getUserFullName(ctx, uid);

                let conv = await this.entities.ConversationRoom.findById(ctx, cid);
                let isChannel = !!(conv && conv.isChannel);

                if (!isChannel) {
                    await this.messaging.sendMessage(ctx, uid, cid, {
                        ...buildMessage(userMention(userName, uid), ` left the group`),
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'user_kick',
                            userId: uid,
                            kickedById: uid
                        },
                    }, true);
                }

                // Deliver dialog deletion
                await this.delivery.onDialogDelete(ctx, uid, cid);
            }

            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async canEditRoom(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let conv = await this.entities.ConversationRoom.findById(ctx, cid);
            if (!conv) {
                return false;
            }

            if (await this.repo.userHaveAdminPermissionsInChat(ctx, conv, uid)) {
                return true;
            }

            //
            // Check membership in chat
            //
            let existingMembership = await this.repo.findMembershipStatus(ctx, uid, cid);
            if (!existingMembership || existingMembership.status !== 'joined') {
                return false;
            }

            //
            //  Anyone can edit secret group
            //
            if (conv.kind === 'group') {
                return true;
            }

            return false;
        });
    }

    async checkCanEditChat(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            if (!await this.canEditRoom(ctx, cid, uid)) {
                throw new AccessDeniedError();
            }
        });
    }

    async checkCanSendMessage(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let conv = await this.entities.ConversationRoom.findById(ctx, cid);
            if (!conv) {
                return false;
            }

            if (await this.repo.userHaveAdminPermissionsInChat(ctx, conv, uid)) {
                return true;
            }

            //
            // Check membership in chat
            //
            let existingMembership = await this.repo.findMembershipStatus(ctx, uid, cid);
            if (!existingMembership || existingMembership.status !== 'joined') {
                return false;
            }

            if (conv.isChannel) {
                return false;
            }

            return true;
        });
    }

    async updateRoomProfile(parent: Context, cid: number, uid: number, profile: Partial<RoomProfileInput>) {
        return await inTx(parent, async (ctx) => {
            let conv = await this.entities.ConversationRoom.findById(ctx, cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let userName = await Modules.Users.getUserFullName(ctx, uid);
            await this.checkCanEditChat(ctx, cid, uid);
            let res = await this.repo.updateRoomProfile(ctx, cid, uid, profile);
            let roomProfile = (await this.entities.RoomProfile.findById(ctx, cid))!;

            if (res.updatedPhoto) {
                await this.messaging.sendMessage(ctx, uid, cid, {
                    ...buildMessage(userMention(userName, uid), ` changed group photo`),
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'photo_change',
                        picture: roomProfile.image
                    },
                });
                let members = await this.entities.RoomParticipant.allFromActive(parent, cid);
                for (let m of members) {
                    await this.delivery.onDialogPhotoUpdate(parent, m.uid, cid, profile.image);
                }
            }
            if (res.updatedTitle) {
                await this.messaging.sendMessage(ctx, uid, cid, {
                    ...buildMessage(userMention(userName, uid), ` changed group name to `, boldString(roomProfile.title)),
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'title_change',
                        title: roomProfile.title
                    },
                });
                let members = await this.entities.RoomParticipant.allFromActive(parent, cid);
                for (let m of members) {
                    await this.delivery.onDialogTitleUpdate(parent, m.uid, cid, profile.title!);
                }
            }

            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async updateWelcomeMessage(parent: Context, cid: number, uid: number, welcomeMessageIsOn: boolean, welcomeMessageSender: number | null | undefined, welcomeMessageText: string | null | undefined) {
        return await inTx(parent, async (ctx) => {
            await this.checkCanEditChat(ctx, cid, uid);
            if (!!welcomeMessageSender) {
                await this.checkCanEditChat(ctx, cid, welcomeMessageSender);
            }
            return await this.repo.updateWelcomeMessage(ctx, cid, welcomeMessageIsOn, welcomeMessageSender, welcomeMessageText);
        });
    }

    async pinMessage(parent: Context, cid: number, uid: number, mid: number) {
        return await inTx(parent, async (ctx) => {
            await this.checkCanEditChat(ctx, cid, uid);
            return await this.repo.pinMessage(ctx, cid, uid, mid);
        });
    }

    async unpinMessage(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            await this.checkCanEditChat(ctx, cid, uid);
            return await this.repo.unpinMessage(ctx, cid, uid);
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

    async onDialogMuteChanged(ctx: Context, uid: number, cid: number, mute: boolean) {
        await this.delivery.onDialogMuteChanged(ctx, uid, cid, mute);
    }

    async moveRoom(ctx: Context, cid: number, uid: number, toOrg: number) {
        return await this.repo.moveRoom(ctx, cid, uid, toOrg);
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

    async resolveConversationWelcomeMessage(ctx: Context, conversationId: number): Promise<WelcomeMessageT | null> {
        return await this.repo.resolveConversationWelcomeMessage(ctx, conversationId);
    }

    async resolveConversationOrganization(ctx: Context, cid: number) {
        return await this.repo.resolveConversationOrganization(ctx, cid);
    }

    async checkAccess(ctx: Context, uid: number, cid: number) {
        return await this.repo.checkAccess(ctx, uid, cid);
    }

    async checkCanUserSeeChat(ctx: Context, uid: number, cid: number) {
        return await this.repo.checkCanUserSeeChat(ctx, uid, cid);
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

    async findAvailableRooms(ctx: Context, uid: number) {
        return await this.repo.findAvailableRooms(ctx, uid);
    }

    private async roomJoinMessageText(parent: Context, room: ConversationRoom, uids: number[], invitedBy: number | null) {
        let emojies = ['🖖', '🖐️', '✋', '🙌', '👏', '👋'];
        let emoji = emojies[Math.floor(Math.random() * emojies.length)] + ' ';

        if (uids.length === 1) {
            if (invitedBy && invitedBy !== uids[0]) {
                let name = await Modules.Users.getUserFullName(parent, uids[0]);
                let inviterName = await Modules.Users.getUserFullName(parent, invitedBy);
                return buildMessage(emoji, userMention(inviterName, invitedBy!), ' invited ', userMention(name, uids[0]));
            } else if (invitedBy && invitedBy === uids[0]) {
                let name = await Modules.Users.getUserFullName(parent, uids[0]);
                return buildMessage(emoji, userMention(name, uids[0]), ' joined the group');
            } else {
                let name = await Modules.Users.getUserFullName(parent, uids[0]);
                return buildMessage(emoji, userMention(name, uids[0]), ' joined the group via invite link');
            }
        } else if (uids.length === 2) {
            let inviterName = await Modules.Users.getUserFullName(parent, invitedBy!);
            let name1 = await Modules.Users.getUserFullName(parent, uids[0]);
            let name2 = await Modules.Users.getUserFullName(parent, uids[1]);
            return buildMessage(emoji, userMention(inviterName, invitedBy!), ' invited ', userMention(name1, uids[0]), ' and ', userMention(name2, uids[1]));
        } else {
            let inviterName = await Modules.Users.getUserFullName(parent, invitedBy!);
            let name = await Modules.Users.getUserFullName(parent, uids[0]);
            return buildMessage(emoji, userMention(inviterName, invitedBy!), ' invited ', userMention(name, uids[0]), ' along with ', usersMention(`${uids.length - 1} others`, uids.splice(1)));
        }
    }

    private async roomJoinMessage(parent: Context, room: ConversationRoom, uid: number, uids: number[], invitedBy: number | null): Promise<MessageInput> {
        return {
            ...await this.roomJoinMessageText(parent, room, uids, invitedBy),
            isService: true,
            isMuted: true,
            serviceMetadata: {
                type: 'user_invite',
                userIds: uids,
                invitedById: uid
            }
        };
    }
}