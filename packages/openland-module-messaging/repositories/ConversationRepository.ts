import { AllEntities } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { AccessDeniedError } from 'openland-server/errors/AccessDeniedError';
import { inTx } from 'foundation-orm/inTx';
import { Repos } from 'openland-server/repositories';
import { Modules } from 'openland-modules/Modules';
import { imageRefEquals } from 'openland-server/repositories/Media';

interface RoomProfileInput {
    title: string;
    image: any;
    description?: string | null;
    socialImage?: any | null;
}

export class ConversationRepository {
    readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async createRoom(kind: 'public' | 'group', oid: number, uid: number, members: number[], profile: RoomProfileInput, message?: string) {
        return await inTx(async () => {
            let id = await this.fetchNextConversationId();
            let conv = await FDB.Conversation.create(id, { kind: 'room' });
            await FDB.ConversationRoom.create(id, { kind, ownerId: oid, oid: kind === 'public' ? oid : undefined, featured: false, listed: kind === 'public' });
            await FDB.RoomProfile.create(id, {
                title: profile.title,
                image: profile.image,
                description: profile.description,
                socialImage: profile.socialImage
            });
            await FDB.RoomParticipant.create(id, uid, {
                role: 'owner',
                invitedBy: uid,
                status: 'joined'
            });
            for (let m of members) {
                await FDB.RoomParticipant.create(id, m, {
                    role: 'member',
                    invitedBy: uid,
                    status: 'joined'
                });
            }
            await Repos.Chats.sendMessage(id, uid, { message: kind === 'group' ? 'Group created' : 'Room created', isService: true });
            if (message) {
                await Repos.Chats.sendMessage(id, uid, { message: message });
            }
            return conv;
        });
    }

    async inviteToRoom(cid: number, uid: number, invites: number[]) {
        return await inTx(async () => {
            let conv = await FDB.ConversationRoom.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let p = await FDB.RoomParticipant.findById(cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            for (let i of invites) {
                let p2 = await FDB.RoomParticipant.findById(cid, i);
                if (!p2) {
                    await FDB.RoomParticipant.create(cid, uid, { role: 'member', invitedBy: uid, status: 'joined' });
                } else if (p2.status !== 'joined') {
                    p2.status = 'joined';
                } else {
                    throw new Error('User already invited');
                }
            }

            let users = invites.map((v) => FDB.UserProfile.findById(v));

            await Repos.Chats.sendMessage(cid, uid, {
                message: `${(await Promise.all(users)).map(u => u!.firstName).join(', ')} joined chat`,
                isService: true,
                isMuted: true,
                serviceMetadata: {
                    type: 'user_invite',
                    userIds: invites,
                    invitedById: uid
                }
            });

            return conv;
        });
    }

    async kickFromRoom(cid: number, uid: number, kickedUid: number) {
        return await inTx(async () => {
            let conv = await FDB.ConversationRoom.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let kickedP = await FDB.RoomParticipant.findById(cid, kickedUid);
            if (!kickedP || kickedP.status !== 'joined') {
                throw new Error('User is not member of a room');
            }
            let p = await FDB.RoomParticipant.findById(cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            // Check permissions
            let isSuperAdmin = (await Repos.Permissions.superRole(uid)) === 'super-admin';
            let canKick = isSuperAdmin || p.role === 'admin' || p.role === 'owner' || kickedP.invitedBy === uid;
            if (!canKick) {
                throw new AccessDeniedError();
            }

            // Kick user from Room
            p.status = 'kicked';

            // Send kick message
            let profile = await Modules.Users.profileById(kickedUid);
            await Repos.Chats.sendMessage(cid, uid, {
                message: `${profile!.firstName} was kicked from chat`,
                isService: true,
                isMuted: true,
                serviceMetadata: {
                    type: 'user_kick',
                    kickedUid,
                    kickedById: uid
                }
            });

            // Reset counter for kicked user
            let mstate = await Modules.Messaging.repo.getUserMessagingState(kickedUid);
            let convState = await Modules.Messaging.repo.getUserDialogState(kickedUid, cid);
            if (convState.unread > 0) {
                mstate.unread = mstate.unread - convState.unread;
                mstate.seq++;
                await FDB.UserDialogEvent.create(kickedUid, mstate.seq, {
                    kind: 'message_read',
                    unread: 0,
                    allUnread: mstate.unread
                });
            }

            return conv;
        });
    }

    async leaveRoom(cid: number, uid: number) {
        return await inTx(async () => {
            let conv = await FDB.ConversationRoom.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let p = await FDB.RoomParticipant.findById(cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of a room');
            }
            p.status = 'left';

            // Send message to everyone
            let profile = await Modules.Users.profileById(uid);
            await Repos.Chats.sendMessage(cid, uid, {
                message: `${profile!.firstName} has left the chat`,
                isService: true,
                isMuted: true,
                serviceMetadata: {
                    type: 'user_kick',
                    userId: uid,
                    kickedById: uid
                }
            });

            // Reset counter for left user
            let mstate = await Modules.Messaging.repo.getUserMessagingState(uid);
            let convState = await Modules.Messaging.repo.getUserDialogState(uid, cid);
            if (convState.unread > 0) {
                mstate.unread = mstate.unread - convState.unread;
                mstate.seq++;
                await FDB.UserDialogEvent.create(uid, mstate.seq, {
                    kind: 'message_read',
                    unread: 0,
                    allUnread: mstate.unread
                });
            }

            return conv;
        });
    }

    async joinRoom(cid: number, uid: number) {
        return await inTx(async () => {
            let conv = await FDB.ConversationRoom.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }

            if (conv.kind !== 'public') {
                throw new Error('You can\'t join non-public rooms');
            }

            let p = await FDB.RoomParticipant.findById(cid, uid);
            if (p && p.status === 'kicked') {
                throw new Error('User was kicked from channel');
            }

            if (p) {
                if (p.status === 'joined') {
                    return conv;
                }
                p.status = 'joined';
            } else {
                await FDB.RoomParticipant.create(cid, uid, { status: 'joined', role: 'member', invitedBy: uid });
            }

            let name = (await Modules.Users.profileById(uid))!.firstName;
            await Repos.Chats.sendMessage(cid, uid, {
                message: `${name} has joined the channel!`,
                isService: true,
                isMuted: true,
                serviceMetadata: {
                    type: 'user_invite',
                    userIds: [uid],
                    invitedById: uid
                }
            });

            return conv;
        });
    }

    async updateRoomProfile(cid: number, uid: number, profile: Partial<RoomProfileInput>) {
        return await inTx(async () => {
            let conv = await FDB.RoomProfile.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let p = await FDB.RoomParticipant.findById(cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            let curMember = await FDB.RoomParticipant.findById(cid, uid);
            let role = await Repos.Permissions.superRole(uid);
            let haveAccess = (curMember && (curMember.role === 'owner' || curMember.role === 'admin')) || role === 'super-admin';

            if (!haveAccess) {
                throw new AccessDeniedError();
            }

            if (profile.title) {
                let res = profile.title.trim();
                if (res !== '' && conv.title !== res) {
                    conv.title = res;
                    await Repos.Chats.sendMessage(cid, uid, {
                        message: `New chat title: ${res}`,
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'title_change',
                            title: res
                        }
                    });
                }
            }

            if (profile.description !== undefined) {
                if (profile.description === null) {
                    if (conv.description !== null) {
                        conv.description = null;
                    }
                } else {
                    let res = profile.description.trim();
                    if (profile.description !== res) {
                        conv.description = res;
                    }
                }
            }

            if (profile.image !== undefined) {
                let imageChanged = false;
                if (profile.image === null) {
                    if (conv.image !== null) {
                        conv.image = null;
                        imageChanged = true;
                    }
                } else {
                    if (!imageRefEquals(profile.image, conv.image)) {
                        conv.image = profile.image;
                        imageChanged = true;
                    }
                }
                if (imageChanged) {
                    await Repos.Chats.sendMessage(cid, uid, {
                        message: `New chat photo`,
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'photo_change',
                            picture: profile.image as any
                        }
                    });
                }
            }

            if (profile.socialImage !== undefined) {
                if (profile.socialImage === null) {
                    if (conv.socialImage !== null) {
                        conv.socialImage = null;
                    }
                } else {
                    if (!imageRefEquals(profile.socialImage, conv.socialImage)) {
                        conv.socialImage = profile.socialImage;
                    }
                }
            }

            return conv;
        });
    }

    async updateMemberRole(cid: number, uid: number, updatedUid: number, role: 'admin' | 'owner' | 'member') {
        return await inTx(async () => {
            let conv = await FDB.RoomProfile.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let p = await FDB.RoomParticipant.findById(cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            let p2 = await FDB.RoomParticipant.findById(cid, updatedUid);
            if (!p2 || p2.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            let canChangeRole = p.role === 'admin' || p.role === 'owner';

            if (!canChangeRole) {
                throw new AccessDeniedError();
            }

            p2.role = role;

            return conv;
        });
    }

    async resolvePrivateChat(uid1: number, uid2: number) {
        return await inTx(async () => {
            let conv = await FDB.ConversationPrivate.findFromUsers(Math.min(uid1, uid2), Math.max(uid1, uid2));
            if (!conv) {
                return await FDB.ConversationPrivate.create(await this.fetchNextConversationId(), { uid1: Math.min(uid1, uid2), uid2: Math.max(uid1, uid2) });
            } else {
                return conv;
            }
        });
    }

    async resolveOrganizationChat(oid: number) {
        return await inTx(async () => {
            let conv = await FDB.ConversationOrganization.findFromOrganization(oid);
            if (!conv) {
                return await FDB.ConversationOrganization.create(await this.fetchNextConversationId(), { oid });
            } else {
                return conv;
            }
        });
    }

    async findConversationMembers(cid: number): Promise<number[]> {
        let conv = (await FDB.Conversation.findById(cid))!;
        if (conv.kind === 'private') {
            let p = (await FDB.ConversationPrivate.findById(cid))!;
            return [p.uid1, p.uid2];
        } else if (conv.kind === 'room') {
            return (await FDB.RoomParticipant.rangeFromActive(cid, 1000)).map((v) => v.uid);
        } else if (conv.kind === 'organization') {
            let org = (await FDB.ConversationOrganization.findById(cid))!;
            return (await FDB.OrganizationMember.rangeFromOrganization('joined', org.id, 1000)).map((v) => v.uid);
        } else {
            throw new Error('Internal error');
        }
    }

    async checkAccess(uid: number, cid: number) {
        let conv = await FDB.Conversation.findById(cid);
        if (!conv) {
            throw new AccessDeniedError();
        }
        if (conv.kind === 'private') {
            let p = await FDB.ConversationPrivate.findById(cid);
            if (!p) {
                throw new AccessDeniedError();
            }
            if (p.uid1 !== uid && p.uid2 !== uid) {
                throw new AccessDeniedError();
            }
        } else if (conv.kind === 'room') {
            let member = await FDB.RoomParticipant.findById(cid, uid);
            if (!member || member.status !== 'joined') {
                throw new AccessDeniedError();
            }
        } else if (conv.kind === 'organization') {
            let org = await FDB.ConversationOrganization.findById(cid);
            if (!org) {
                throw new AccessDeniedError();
            }
            let member = await FDB.OrganizationMember.findById(org.oid, uid);
            if (!member || member.status !== 'joined') {
                throw new AccessDeniedError();
            }
        } else {
            throw new AccessDeniedError();
        }
    }

    async setFeatured(cid: number, featued: boolean) {
        await inTx(async () => {
            let room = await FDB.ConversationRoom.findById(cid);
            if (!room) {
                throw new AccessDeniedError();
            }
            room.featured = featued;
        });
    }

    async setListed(cid: number, listed: boolean) {
        await inTx(async () => {
            let room = await FDB.ConversationRoom.findById(cid);
            if (!room) {
                throw new AccessDeniedError();
            }
            room.listed = listed;
        });
    }

    private async fetchNextConversationId() {
        return await inTx(async () => {
            let sequence = await FDB.Sequence.findById('conversation-id');
            if (!sequence) {
                sequence = (await FDB.Sequence.create('conversation-id', { value: 0 }));
                await sequence.flush();
            }
            return ++sequence.value;
        });
    }
}