import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { buildBaseImageUrl, imageRefEquals } from 'openland-module-media/ImageRef';
import { IDs } from 'openland-module-api/IDs';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { DeliveryMediator } from 'openland-module-messaging/mediators/DeliveryMediator';
import { RoomProfileInput } from 'openland-module-messaging/RoomProfileInput';

function doSimpleHash(key: string): number {
    var h = 0, l = key.length, i = 0;
    if (l > 0) {
        while (i < l) {
            h = (h << 5) - h + key.charCodeAt(i++) | 0;
        }
    }
    return Math.abs(h);
}

@injectable()
export class RoomRepository {
    @lazyInject('FDB') private readonly entities!: AllEntities;
    @lazyInject('DeliveryMediator') private readonly delivery!: DeliveryMediator;

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

    async createRoom(kind: 'public' | 'group', oid: number, uid: number, members: number[], profile: RoomProfileInput, message?: string) {
        return await inTx(async () => {
            let id = await this.fetchNextConversationId();
            let conv = await this.entities.Conversation.create(id, { kind: 'room' });
            await (await this.entities.ConversationRoom.create(id, { kind, ownerId: oid, oid: kind === 'public' ? oid : undefined, featured: false, listed: kind === 'public' })).flush();
            await this.entities.RoomProfile.create(id, {
                title: profile.title,
                image: profile.image,
                description: profile.description,
                socialImage: profile.socialImage
            });
            await (await this.entities.RoomParticipant.create(id, uid, {
                role: 'owner',
                invitedBy: uid,
                status: 'joined'
            })).flush();
            for (let m of members) {
                await (await this.entities.RoomParticipant.create(id, m, {
                    role: 'member',
                    invitedBy: uid,
                    status: 'joined'
                })).flush();
            }
            await conv.flush();
            await Modules.Messaging.sendMessage(id, uid, { message: kind === 'group' ? 'Group created' : 'Room created', isService: true });
            if (message) {
                await Modules.Messaging.sendMessage(id, uid, { message: message });
            }
            return conv;
        });
    }

    async inviteToRoom(cid: number, uid: number, invites: number[]) {
        return await inTx(async () => {
            let conv = await this.entities.ConversationRoom.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let p = await this.entities.RoomParticipant.findById(cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            for (let i of invites) {
                let p2 = await this.entities.RoomParticipant.findById(cid, i);
                if (!p2) {
                    await this.entities.RoomParticipant.create(cid, uid, { role: 'member', invitedBy: uid, status: 'joined' });
                } else if (p2.status !== 'joined') {
                    p2.status = 'joined';
                } else {
                    throw new Error('User already invited');
                }
            }

            let users = invites.map((v) => this.entities.UserProfile.findById(v));

            await Modules.Messaging.sendMessage(cid, uid, {
                message: `${(await Promise.all(users)).map(u => u!.firstName).join(', ')} joined the room`,
                isService: true,
                isMuted: true,
                serviceMetadata: {
                    type: 'user_invite',
                    userIds: invites,
                    invitedById: uid
                }
            });

            return (await this.entities.Conversation.findById(conv.id))!;
        });
    }

    async kickFromRoom(cid: number, uid: number, kickedUid: number) {
        return await inTx(async () => {
            let conv = await this.entities.ConversationRoom.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let kickedP = await this.entities.RoomParticipant.findById(cid, kickedUid);
            if (!kickedP || kickedP.status !== 'joined') {
                throw new Error('User is not member of a room');
            }
            let p = await this.entities.RoomParticipant.findById(cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            // Check permissions
            let isSuperAdmin = (await Modules.Super.superRole(uid)) === 'super-admin';
            let canKick = isSuperAdmin || p.role === 'admin' || p.role === 'owner' || kickedP.invitedBy === uid;
            if (!canKick) {
                throw new AccessDeniedError();
            }

            // Kick user from Room
            kickedP.status = 'kicked';
            await kickedP.flush();

            // Send kick message
            let profile = await Modules.Users.profileById(kickedUid);
            await Modules.Messaging.sendMessage(cid, uid, {
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

            return (await this.entities.Conversation.findById(conv.id))!;
        });
    }

    async leaveRoom(cid: number, uid: number) {
        return await inTx(async () => {
            let conv = await this.entities.ConversationRoom.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let p = await this.entities.RoomParticipant.findById(cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of the room');
            }
            p.status = 'left';

            // Send message to everyone
            let profile = await Modules.Users.profileById(uid);
            await Modules.Messaging.sendMessage(cid, uid, {
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

            return (await this.entities.Conversation.findById(conv.id))!;
        });
    }

    async joinRoom(cid: number, uid: number) {
        return await inTx(async () => {
            let conv = await this.entities.ConversationRoom.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }

            if (conv.kind !== 'public') {
                throw new Error('You can\'t join non-public rooms');
            }

            let p = await this.entities.RoomParticipant.findById(cid, uid);
            if (p && p.status === 'kicked') {
                throw new Error('User was kicked from channel');
            }

            if (p) {
                if (p.status === 'joined') {
                    return conv;
                }
                p.status = 'joined';
            } else {
                await this.entities.RoomParticipant.create(cid, uid, { status: 'joined', role: 'member', invitedBy: uid });
            }

            let name = (await Modules.Users.profileById(uid))!.firstName;
            await Modules.Messaging.sendMessage(cid, uid, {
                message: `${name} has joined the room!`,
                isService: true,
                isMuted: true,
                serviceMetadata: {
                    type: 'user_invite',
                    userIds: [uid],
                    invitedById: uid
                }
            });

            return (await this.entities.Conversation.findById(conv.id))!;
        });
    }

    async updateRoomProfile(cid: number, uid: number, profile: Partial<RoomProfileInput>) {
        return await inTx(async () => {
            let conv = await this.entities.RoomProfile.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let p = await this.entities.RoomParticipant.findById(cid, uid);
            if (!p || p.status !== 'joined') {
                throw new Error('User is not member of a room');
            }

            let curMember = await this.entities.RoomParticipant.findById(cid, uid);
            let role = await Modules.Super.superRole(uid);
            let haveAccess = (curMember && (curMember.role === 'owner' || curMember.role === 'admin')) || role === 'super-admin';

            if (!haveAccess) {
                throw new AccessDeniedError();
            }

            if (profile.title) {
                let res = profile.title.trim();
                if (res !== '' && conv.title !== res) {
                    conv.title = res;
                    await Modules.Messaging.sendMessage(cid, uid, {
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
                    if (conv.description !== res) {
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
                    await Modules.Messaging.sendMessage(cid, uid, {
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

            return (await this.entities.Conversation.findById(conv.id))!;
        });
    }

    async updateMemberRole(cid: number, uid: number, updatedUid: number, role: 'admin' | 'owner' | 'member') {
        return await inTx(async () => {
            let conv = await this.entities.RoomProfile.findById(cid);
            if (!conv) {
                throw new Error('Room not found');
            }
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

            p2.role = role;

            return (await this.entities.Conversation.findById(conv.id))!;
        });
    }

    async resolvePrivateChat(uid1: number, uid2: number) {
        return await inTx(async () => {
            let conv = await this.entities.ConversationPrivate.findFromUsers(Math.min(uid1, uid2), Math.max(uid1, uid2));
            if (!conv) {
                let id = await this.fetchNextConversationId();
                await (await this.entities.Conversation.create(id, { kind: 'private' })).flush();
                conv = await this.entities.ConversationPrivate.create(id, { uid1: Math.min(uid1, uid2), uid2: Math.max(uid1, uid2) });
                await conv.flush();
            }
            return (await this.entities.Conversation.findById(conv.id))!;
        });
    }

    async resolveOrganizationChat(oid: number) {
        return await inTx(async () => {
            let conv = await this.entities.ConversationOrganization.findFromOrganization(oid);
            if (!conv) {
                let id = await this.fetchNextConversationId();
                await (await this.entities.Conversation.create(id, { kind: 'organization' })).flush();
                conv = await this.entities.ConversationOrganization.create(id, { oid });
                await conv.flush();
            }
            return (await this.entities.Conversation.findById(conv.id))!;
        });
    }

    async findConversationMembers(cid: number): Promise<number[]> {
        let conv = (await this.entities.Conversation.findById(cid))!;
        if (conv.kind === 'private') {
            let p = (await this.entities.ConversationPrivate.findById(cid))!;
            return [p.uid1, p.uid2];
        } else if (conv.kind === 'room') {
            return (await this.entities.RoomParticipant.rangeFromActive(cid, 1000)).map((v) => v.uid);
        } else if (conv.kind === 'organization') {
            let org = (await this.entities.ConversationOrganization.findById(cid))!;
            return (await this.entities.OrganizationMember.allFromOrganization('joined', org.oid)).map((v) => v.uid);
        } else {
            throw new Error('Internal error');
        }
    }

    async resolveConversationTitle(conversationId: number, uid: number): Promise<string> {
        let conv = await this.entities.Conversation.findById(conversationId);

        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }

        if (conv.kind === 'private') {
            let p = (await this.entities.ConversationPrivate.findById(conv.id))!;
            let _uid;
            if (p.uid1 === uid) {
                _uid = p.uid2;
            } else if (p.uid2 === uid) {
                _uid = p.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await Modules.Users.profileById(_uid))!;
            return [profile.firstName, profile.lastName].filter((v) => !!v).join(' ');
        } else if (conv.kind === 'organization') {
            let o = await this.entities.ConversationOrganization.findById(conv.id);
            return (await this.entities.OrganizationProfile.findById(o!.oid))!.name;
        } else {
            let r = (await this.entities.ConversationRoom.findById(conv.id))!;
            let p = (await this.entities.RoomProfile.findById(conv.id))!;
            if (r.kind === 'group') {
                if (p.title !== '') {
                    return p.title;
                }
                let res = (await this.entities.RoomParticipant.allFromActive(conv.id)).filter((v) => v.uid !== uid);
                let name: string[] = [];
                for (let r2 of res) {
                    let p2 = (await Modules.Users.profileById(r2.uid))!!;
                    name.push([p2.firstName, p2.lastName].filter((v) => !!v).join(' '));
                }
                return name.join(', ');
            }
            return p.title;
        }
    }

    async resolveConversationPhoto(conversationId: number, uid: number): Promise<string | null> {
        let conv = await this.entities.Conversation.findById(conversationId);

        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }

        if (conv.kind === 'private') {
            let p = (await this.entities.ConversationPrivate.findById(conv.id))!;
            let _uid;
            if (p.uid1 === uid) {
                _uid = p.uid2;
            } else if (p.uid2 === uid) {
                _uid = p.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await Modules.Users.profileById(_uid))!;
            let res = buildBaseImageUrl(profile.picture);
            if (res) {
                return res;
            } else {
                return 'ph://' + doSimpleHash(IDs.User.serialize(_uid)) % 6;
            }
        } else if (conv.kind === 'organization') {
            let o = await this.entities.ConversationOrganization.findById(conv.id);
            let res = buildBaseImageUrl((await this.entities.OrganizationProfile.findById(o!.oid))!.photo);
            if (res) {
                return res;
            } else {
                return 'ph://' + doSimpleHash(IDs.Organization.serialize(o!.oid)) % 6;
            }
        } else {
            let p = (await this.entities.RoomProfile.findById(conv.id))!;
            let res = buildBaseImageUrl(p.image);
            if (res) {
                return res;
            } else {
                return 'ph://' + doSimpleHash(IDs.Conversation.serialize(conv.id)) % 6;
            }
        }
    }

    async checkAccess(uid: number, cid: number) {
        let conv = await this.entities.Conversation.findById(cid);
        if (!conv) {
            throw new AccessDeniedError();
        }
        if (conv.kind === 'private') {
            let p = await this.entities.ConversationPrivate.findById(cid);
            if (!p) {
                throw new AccessDeniedError();
            }
            if (p.uid1 !== uid && p.uid2 !== uid) {
                throw new AccessDeniedError();
            }
        } else if (conv.kind === 'room') {
            let member = await this.entities.RoomParticipant.findById(cid, uid);
            if (!member || member.status !== 'joined') {
                throw new AccessDeniedError();
            }
        } else if (conv.kind === 'organization') {
            let org = await this.entities.ConversationOrganization.findById(cid);
            if (!org) {
                throw new AccessDeniedError();
            }
            let member = await this.entities.OrganizationMember.findById(org.oid, uid);
            if (!member || member.status !== 'joined') {
                throw new AccessDeniedError();
            }
        } else {
            throw new AccessDeniedError();
        }
    }

    async setFeatured(cid: number, featued: boolean) {
        await inTx(async () => {
            let room = await this.entities.ConversationRoom.findById(cid);
            if (!room) {
                throw new AccessDeniedError();
            }
            room.featured = featued;
        });
    }

    async setListed(cid: number, listed: boolean) {
        await inTx(async () => {
            let room = await this.entities.ConversationRoom.findById(cid);
            if (!room) {
                throw new AccessDeniedError();
            }
            room.listed = listed;
        });
    }

    private async fetchNextConversationId() {
        return await inTx(async () => {
            let sequence = await this.entities.Sequence.findById('conversation-id');
            if (!sequence) {
                sequence = (await this.entities.Sequence.create('conversation-id', { value: 0 }));
                await sequence.flush();
            }
            return ++sequence.value;
        });
    }
}