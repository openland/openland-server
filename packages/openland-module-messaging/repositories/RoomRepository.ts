import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { buildBaseImageUrl, imageRefEquals } from 'openland-module-media/ImageRef';
import { IDs } from 'openland-module-api/IDs';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { RoomProfileInput } from 'openland-module-messaging/RoomProfileInput';
import { Context } from 'openland-utils/Context';

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

    async createRoom(parent: Context, kind: 'public' | 'group', oid: number, uid: number, members: number[], profile: RoomProfileInput, listed?: boolean) {
        return await inTx(parent, async (ctx) => {
            let id = await this.fetchNextConversationId(ctx);
            let conv = await this.entities.Conversation.create(ctx, id, { kind: 'room' });
            await this.entities.ConversationRoom.create(ctx, id, {
                kind,
                ownerId: uid,
                oid: kind === 'public' ? oid : undefined,
                featured: false,
                listed: kind === 'public' && listed !== false
            });
            await this.entities.RoomProfile.create(ctx, id, {
                title: profile.title,
                image: profile.image,
                description: profile.description,
                socialImage: profile.socialImage
            });
            await this.entities.RoomParticipant.create(ctx, id, uid, {
                role: 'owner',
                invitedBy: uid,
                status: 'joined'
            });
            for (let m of members) {
                if (m === uid) {
                    continue; // Just in case of bad input
                }
                await this.entities.RoomParticipant.create(ctx, id, m, {
                    role: 'member',
                    invitedBy: uid,
                    status: 'joined'
                });
            }

            return conv;
        });
    }

    async addToRoom(parent: Context, cid: number, uid: number, by: number) {
        return await inTx(parent, async (ctx) => {

            // Check if room exists
            await this.checkRoomExists(ctx, cid);

            // Create or update room participant
            let p = await this.entities.RoomParticipant.findById(ctx, cid, uid);
            if (p) {
                if (p.status === 'joined') {
                    return false;
                } else {
                    p.status = 'joined';
                    p.invitedBy = by;
                    return true;
                }
            } else {
                await this.entities.RoomParticipant.create(ctx, cid, uid, {
                    status: 'joined',
                    invitedBy: by,
                    role: 'member'
                });
                return true;
            }
        });
    }

    async kickFromRoom(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            // Check if room exists
            await this.checkRoomExists(ctx, cid);

            // Kick user from Room
            let participant = await this.entities.RoomParticipant.findById(ctx, cid, uid);
            if (!participant || participant.status !== 'joined') {
                return false;
            }
            participant.status = 'kicked';
            return true;
        });
    }

    async leaveRoom(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {

            // Check if room exists
            await this.checkRoomExists(ctx, cid);

            let p = await this.entities.RoomParticipant.findById(ctx, cid, uid);
            if (!p || p.status !== 'joined') {
                return false;
            }
            p.status = 'left';
            return true;
        });
    }

    async joinRoom(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            // Check if room exists
            await this.checkRoomExists(ctx, cid);

            let p = await this.entities.RoomParticipant.findById(ctx, cid, uid);
            if (p) {
                if (p.status === 'joined') {
                    return false;
                } else {
                    p.invitedBy = uid;
                    p.status = 'joined';
                    return true;
                }
            } else {
                await this.entities.RoomParticipant.create(ctx, cid, uid, {
                    status: 'joined',
                    role: 'member',
                    invitedBy: uid
                });
                return true;
            }
        });
    }

    async updateRoomProfile(parent: Context, cid: number, profile: Partial<RoomProfileInput>) {
        return await inTx(parent, async (ctx) => {
            await this.checkRoomExists(ctx, cid);

            let conv = await this.entities.RoomProfile.findById(ctx, cid);
            if (!conv) {
                throw new Error('Room not found');
            }

            let updatedTitle = false;
            let updatedPhoto = false;

            if (profile.title) {
                let res = profile.title.trim();
                if (res !== '' && conv.title !== res) {
                    conv.title = res;
                    updatedTitle = true;
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
                if (profile.image === null) {
                    if (conv.image !== null) {
                        conv.image = null;
                        updatedPhoto = true;
                    }
                } else {
                    if (!imageRefEquals(profile.image, conv.image)) {
                        conv.image = profile.image;
                        updatedPhoto = true;
                    }
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

            return { updatedTitle, updatedPhoto };
        });
    }

    async updateMemberRole(parent: Context, cid: number, uid: number, updatedUid: number, role: 'admin' | 'owner' | 'member') {
        return await inTx(parent, async (ctx) => {
            let conv = await this.entities.RoomProfile.findById(ctx, cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let p2 = await this.entities.RoomParticipant.findById(ctx, cid, updatedUid);
            if (!p2 || p2.status !== 'joined') {
                throw new Error('User is not member of a room');
            }
            p2.role = role;
            return (await this.entities.Conversation.findById(ctx, conv.id))!;
        });
    }

    //
    // Editorial
    //

    async setFeatured(parent: Context, cid: number, featued: boolean) {
        return await inTx(parent, async (ctx) => {
            let room = await this.entities.ConversationRoom.findById(ctx, cid);
            if (!room) {
                throw new AccessDeniedError();
            }
            room.featured = featued;
            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    async setListed(parent: Context, cid: number, listed: boolean) {
        return await inTx(parent, async (ctx) => {
            let room = await this.entities.ConversationRoom.findById(ctx, cid);
            if (!room) {
                throw new AccessDeniedError();
            }
            room.listed = listed;
            return (await this.entities.Conversation.findById(ctx, cid))!;
        });
    }

    //
    // Queries
    //

    async checkRoomExists(ctx: Context, cid: number) {
        let conv = await this.entities.ConversationRoom.findById(ctx, cid);
        if (!conv) {
            throw new Error('Room not found');
        }
    }

    async isActiveMember(ctx: Context, uid: number, cid: number) {
        let p = await this.entities.RoomParticipant.findById(ctx, cid, uid);
        if (!p) {
            return false;
        }
        if (p.status === 'joined') {
            return true;
        } else {
            return false;
        }
    }

    async findMembershipStatus(ctx: Context, uid: number, cid: number) {
        let p = await this.entities.RoomParticipant.findById(ctx, cid, uid);
        if (!p) {
            return null;
        }
        return p;
    }

    async resolveUserMembershipStatus(ctx: Context, uid: number, cid: number) {
        let participant = await this.entities.RoomParticipant.findById(ctx, uid, cid);
        return participant ? participant.status : 'none';
    }

    async findActiveMembers(ctx: Context, cid: number) {
        return this.entities.RoomParticipant.allFromActive(ctx, cid);
    }

    async roomMembersCount(ctx: Context, conversationId: number, status?: string): Promise<number> {
        return (await this.entities.RoomParticipant.allFromActive(ctx, conversationId)).filter(m => status === undefined || m.status === status).length;
    }

    async resolvePrivateChat(parent: Context, uid1: number, uid2: number) {
        let conv2 = await this.entities.ConversationPrivate.findFromUsers(parent, Math.min(uid1, uid2), Math.max(uid1, uid2));
        if (conv2) {
            return (await this.entities.Conversation.findById(parent, conv2.id))!;
        }
        return await inTx(parent, async (ctx) => {
            let conv = await this.entities.ConversationPrivate.findFromUsers(ctx, Math.min(uid1, uid2), Math.max(uid1, uid2));
            if (!conv) {
                let id = await this.fetchNextConversationId(ctx);
                await (await this.entities.Conversation.create(ctx, id, { kind: 'private' })).flush();
                conv = await this.entities.ConversationPrivate.create(ctx, id, { uid1: Math.min(uid1, uid2), uid2: Math.max(uid1, uid2) });
                await conv.flush();
            }
            return (await this.entities.Conversation.findById(ctx, conv.id))!;
        });
    }

    async resolveOrganizationChat(parent: Context, oid: number) {
        return await inTx(parent, async (ctx) => {
            let conv = await this.entities.ConversationOrganization.findFromOrganization(ctx, oid);
            if (!conv) {
                let id = await this.fetchNextConversationId(ctx);
                await (await this.entities.Conversation.create(ctx, id, { kind: 'organization' })).flush();
                conv = await this.entities.ConversationOrganization.create(ctx, id, { oid });
                await conv.flush();
            }
            return (await this.entities.Conversation.findById(ctx, conv.id))!;
        });
    }

    async findConversationMembers(ctx: Context, cid: number): Promise<number[]> {
        let conv = (await this.entities.Conversation.findById(ctx, cid))!;
        if (conv.kind === 'private') {
            let p = (await this.entities.ConversationPrivate.findById(ctx, cid))!;
            return [p.uid1, p.uid2];
        } else if (conv.kind === 'room') {
            return (await this.entities.RoomParticipant.rangeFromActive(ctx, cid, 1000)).map((v) => v.uid);
        } else if (conv.kind === 'organization') {
            let org = (await this.entities.ConversationOrganization.findById(ctx, cid))!;
            return (await this.entities.OrganizationMember.allFromOrganization(ctx, 'joined', org.oid)).map((v) => v.uid);
        } else {
            throw new Error('Internal error');
        }
    }

    async resolveConversationTitle(ctx: Context, conversationId: number, uid: number): Promise<string> {
        let conv = await this.entities.Conversation.findById(ctx, conversationId);

        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }

        if (conv.kind === 'private') {
            let p = (await this.entities.ConversationPrivate.findById(ctx, conv.id))!;
            let _uid;
            if (p.uid1 === uid) {
                _uid = p.uid2;
            } else if (p.uid2 === uid) {
                _uid = p.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await this.entities.UserProfile.findById(ctx, _uid))!;
            return [profile.firstName, profile.lastName].filter((v) => !!v).join(' ');
        } else if (conv.kind === 'organization') {
            let o = await this.entities.ConversationOrganization.findById(ctx, conv.id);
            return (await this.entities.OrganizationProfile.findById(ctx, o!.oid))!.name;
        } else {
            let r = (await this.entities.ConversationRoom.findById(ctx, conv.id))!;
            let p = (await this.entities.RoomProfile.findById(ctx, conv.id))!;
            if (r.kind === 'group') {
                if (p.title !== '') {
                    return p.title;
                }
                let res = (await this.entities.RoomParticipant.allFromActive(ctx, conv.id)).filter((v) => v.uid !== uid);
                let name: string[] = [];
                for (let r2 of res) {
                    let p2 = (await this.entities.UserProfile.findById(ctx, r2.uid))!;
                    name.push([p2.firstName, p2.lastName].filter((v) => !!v).join(' '));
                }
                return name.join(', ');
            }
            return p.title;
        }
    }

    async resolveConversationPhoto(ctx: Context, conversationId: number, uid: number): Promise<string | null> {
        let conv = await this.entities.Conversation.findById(ctx, conversationId);

        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }

        if (conv.kind === 'private') {
            let p = (await this.entities.ConversationPrivate.findById(ctx, conv.id))!;
            let _uid;
            if (p.uid1 === uid) {
                _uid = p.uid2;
            } else if (p.uid2 === uid) {
                _uid = p.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await this.entities.UserProfile.findById(ctx, _uid))!;
            let res = buildBaseImageUrl(profile.picture);
            if (res) {
                return res;
            } else {
                return 'ph://' + doSimpleHash(IDs.User.serialize(_uid)) % 6;
            }
        } else if (conv.kind === 'organization') {
            let o = await this.entities.ConversationOrganization.findById(ctx, conv.id);
            let res = buildBaseImageUrl((await this.entities.OrganizationProfile.findById(ctx, o!.oid))!.photo);
            if (res) {
                return res;
            } else {
                return 'ph://' + doSimpleHash(IDs.Organization.serialize(o!.oid)) % 6;
            }
        } else {
            let p = (await this.entities.RoomProfile.findById(ctx, conv.id))!;
            let res = buildBaseImageUrl(p.image);
            if (res) {
                return res;
            } else {
                return 'ph://' + doSimpleHash(IDs.Conversation.serialize(conv.id)) % 6;
            }
        }
    }

    async checkAccess(ctx: Context, uid: number, cid: number) {
        let conv = await this.entities.Conversation.findById(ctx, cid);
        if (!conv) {
            throw new AccessDeniedError();
        }
        if (conv.kind === 'private') {
            let p = await this.entities.ConversationPrivate.findById(ctx, cid);
            if (!p) {
                throw new AccessDeniedError();
            }
            if (p.uid1 !== uid && p.uid2 !== uid) {
                throw new AccessDeniedError();
            }
        } else if (conv.kind === 'room') {
            let member = await this.entities.RoomParticipant.findById(ctx, cid, uid);
            if (!member || member.status !== 'joined') {
                throw new AccessDeniedError();
            }
        } else if (conv.kind === 'organization') {
            let org = await this.entities.ConversationOrganization.findById(ctx, cid);
            if (!org) {
                throw new AccessDeniedError();
            }
            let member = await this.entities.OrganizationMember.findById(ctx, org.oid, uid);
            if (!member || member.status !== 'joined') {
                throw new AccessDeniedError();
            }
        } else {
            throw new AccessDeniedError();
        }
    }

    //
    // Internals
    //

    private async fetchNextConversationId(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let sequence = await this.entities.Sequence.findById(ctx, 'conversation-id');
            if (!sequence) {
                sequence = (await this.entities.Sequence.create(ctx, 'conversation-id', { value: 0 }));
                await sequence.flush();
            }
            return ++sequence.value;
        });
    }
}