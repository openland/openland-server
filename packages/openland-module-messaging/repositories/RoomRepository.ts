import { ExpiringCache } from './../../openland-utils/ExpiringCache';
import { RoomParticipantCreateShape, Message, ChatUpdatedEvent } from './../../openland-module-db/store';
import { Store } from 'openland-module-db/FDB';
import { inTx, encoders } from '@openland/foundationdb';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { buildBaseImageUrl, imageRefEquals } from 'openland-module-media/ImageRef';
import { IDs } from 'openland-module-api/IDs';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { RoomProfileInput } from 'openland-module-messaging/RoomProfileInput';
import { Context } from '@openland/context';
import { Modules } from '../../openland-modules/Modules';
// import { MessagingRepository } from './MessagingRepository';
import { boldString, buildMessage, userMention } from '../../openland-utils/MessageBuilder';
import { MessageAttachmentFile } from '../MessageInput';
import { ChatMetricsRepository } from './ChatMetricsRepository';
import { User, ConversationRoom } from 'openland-module-db/store';
import { smartSlice } from '../../openland-utils/string';
import { UserChatsRepository } from './UserChatsRepository';
import { FastCountersMediator } from '../mediators/FastCountersMediator';
import { ExperimentalCountersRepository } from './ExperimentalCountersRepository';
import { UserReadSeqsDirectory } from './UserReadSeqsDirectory';
import { ChatsMembersListDirectory } from './ChatsMembersListDirectory';

function doSimpleHash(key: string): number {
    var h = 0, l = key.length, i = 0;
    if (l > 0) {
        while (i < l) {
            h = (h << 5) - h + key.charCodeAt(i++) | 0;
        }
    }
    return Math.abs(h);
}

export type WelcomeMessageT = {
    type: 'WelcomeMessage',
    isOn: boolean,
    sender: User | null,
    message: string
};

@injectable()
export class RoomRepository {
    // @lazyInject('MessagingRepository') private readonly messageRepo!: MessagingRepository;
    @lazyInject('ChatMetricsRepository') readonly metrics!: ChatMetricsRepository;

    @lazyInject('FastCountersMediator')
    readonly fastCounters!: FastCountersMediator;

    @lazyInject('ExperimentalCountersRepository')
    readonly experimentalCounters!: ExperimentalCountersRepository;

    @lazyInject('UserReadSeqsDirectory')
    readonly userReadSeqs!: UserReadSeqsDirectory;

    @lazyInject('ChatsMembersListDirectory')
    readonly chatMembers!: ChatsMembersListDirectory;

    private membersCache = new ExpiringCache<number[]>({ timeout: 15 * 60 * 1000 });

    readonly userChats = new UserChatsRepository();

    async createRoom(parent: Context, kind: 'public' | 'group', oid: number | undefined, uid: number, members: number[], profile: RoomProfileInput, listed?: boolean, channel?: boolean, price?: number, interval?: 'week' | 'month') {
        return await inTx(parent, async (ctx) => {
            let id = await this.fetchNextConversationId(ctx);
            let conv = await Store.Conversation.create(ctx, id, { kind: 'room' });
            await Store.ConversationRoom.create(ctx, id, {
                kind,
                ownerId: uid,
                oid: kind === 'public' ? oid : undefined,
                featured: false,
                listed: kind === 'public' && listed !== false,
                isChannel: channel,
                isPremium: !!price
            });

            let serviceMessagesEnabled = true;

            if (kind === 'group') {
                serviceMessagesEnabled = true;
            }
            if (kind === 'public') {
                serviceMessagesEnabled = false;
            }
            if (oid) {
                let org = await Store.Organization.findById(ctx, oid);
                if (org && org.kind === 'community') {
                    serviceMessagesEnabled = false;
                }
            }

            await Store.RoomProfile.create(ctx, id, {
                title: profile.title,
                image: profile.image,
                description: profile.description,
                socialImage: profile.socialImage,
                repliesDisabled: false,
                joinsMessageDisabled: !serviceMessagesEnabled,
                leavesMessageDisabled: !serviceMessagesEnabled
            });
            if (price) {
                await Store.PremiumChatSettings.create(ctx, id, {
                    price,
                    interval: interval,
                });
                await Store.PremiumChatUserPass.create(ctx, id, uid, { isActive: true });
            }
            await this.createRoomParticipant(ctx, id, uid, {
                role: 'owner',
                invitedBy: uid,
                status: 'joined'
            });
            await this.setParticipant(ctx, id, uid, true, false);

            let memberNo = 0;
            for (let m of [...new Set(members)]) {
                if (m === uid) {
                    continue; // Just in case of bad input
                }
                await this.createRoomParticipant(ctx, id, m, {
                    role: 'member',
                    invitedBy: uid,
                    status: 'joined'
                });
                await this.setParticipant(ctx, id, m, true, memberNo > 50);
                memberNo++;
            }

            return conv;
        });
    }

    async addToRoom(parent: Context, cid: number, uid: number, by: number) {
        return await inTx(parent, async (ctx) => {

            // Check if room exists
            await this.checkRoomExists(ctx, cid);

            let activeMembersCount = await this.roomMembersCount(ctx, cid, 'joined');
            let isAsyncMember = activeMembersCount >= 50;

            // Create or update room participant
            let p = await Store.RoomParticipant.findById(ctx, cid, uid);
            if (p) {
                if (p.status === 'joined') {
                    return false;
                } else {
                    p.status = 'joined';
                    p.invitedBy = by;
                    Store.RoomParticipantsVersion.increment(ctx, cid);
                    await this.setParticipant(ctx, cid, uid, true, isAsyncMember);
                    await this.incrementRoomActiveMembers(ctx, cid);
                    return true;
                }
            } else {
                await this.createRoomParticipant(ctx, cid, uid, {
                    status: 'joined',
                    invitedBy: by,
                    role: 'member'
                });
                Store.RoomParticipantsVersion.increment(ctx, cid);
                await this.setParticipant(ctx, cid, uid, true, isAsyncMember);
                return true;
            }
        });
    }

    async kickFromRoom(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            // Check if room exists
            await this.checkRoomExists(ctx, cid);

            // Kick user from Room
            let participant = await Store.RoomParticipant.findById(ctx, cid, uid);
            if (!participant || participant.status !== 'joined') {
                return false;
            }
            participant.status = 'kicked';
            Store.RoomParticipantsVersion.increment(ctx, cid);
            await this.setParticipant(ctx, cid, uid, false, false);
            await this.decrementRoomActiveMembers(ctx, cid);
            return true;
        });
    }

    async declineJoinRoomRequest(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            // Check if room exists
            await this.checkRoomExists(ctx, cid);

            // Decline request
            let participant = await Store.RoomParticipant.findById(ctx, cid, uid);
            if (!participant || participant.status !== 'requested') {
                return false;
            }
            participant.status = 'kicked';
            Store.RoomParticipantsVersion.increment(ctx, cid);
            await this.setParticipant(ctx, cid, uid, false, false);
            return true;
        });
    }

    async leaveRoom(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {

            // Check if room exists
            await this.checkRoomExists(ctx, cid);

            let p = await Store.RoomParticipant.findById(ctx, cid, uid);
            if (!p || p.status !== 'joined') {
                return false;
            }
            p.status = 'left';
            Store.RoomParticipantsVersion.increment(ctx, cid);
            await this.setParticipant(ctx, cid, uid, false, false);
            await this.decrementRoomActiveMembers(ctx, cid);
            return true;
        });
    }

    async joinRoom(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            // Check if room exists
            await this.checkRoomExists(ctx, cid);

            let activeMembersCount = await this.roomMembersCount(ctx, cid, 'joined');
            let isAsyncMember = activeMembersCount >= 50;

            // let targetStatus: 'requested' | 'joined' = request ? 'requested' : 'joined';
            let p = await Store.RoomParticipant.findById(ctx, cid, uid);
            if (p) {
                if (p.status === 'joined') {
                    return false;
                } else {
                    p.invitedBy = uid;
                    p.status = 'joined';
                    Store.RoomParticipantsVersion.increment(ctx, cid);
                    await this.setParticipant(ctx, cid, uid, true, isAsyncMember);
                    await this.incrementRoomActiveMembers(ctx, cid);
                    return true;
                }
            } else {
                await this.createRoomParticipant(ctx, cid, uid, {
                    status: 'joined',
                    role: 'member',
                    invitedBy: uid
                });
                Store.RoomParticipantsVersion.increment(ctx, cid);
                await this.setParticipant(ctx, cid, uid, true, isAsyncMember);
                return true;
            }
        });
    }

    async updateRoomProfile(parent: Context, cid: number, uid: number, profile: Partial<RoomProfileInput>) {
        return await inTx(parent, async (ctx) => {
            await this.checkRoomExists(ctx, cid);

            let conv = await Store.RoomProfile.findById(ctx, cid);
            if (!conv) {
                throw new Error('Room not found');
            }

            let updatedTitle = false;
            let updatedPhoto = false;
            let kindChanged = false;
            let repliesUpdated = false;
            let callSettingsUpdated = false;

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

            if (profile.kind !== undefined && profile.kind !== null) {
                if (!await Modules.Super.superRole(ctx, uid)) {
                    throw new AccessDeniedError();
                }
                let room = await Store.ConversationRoom.findById(ctx, cid);
                room!.kind = profile.kind!;
                room!.listed = profile.kind === 'public' && room!.listed;

                kindChanged = true;
            }

            if (profile.repliesEnabled !== undefined && profile.repliesEnabled !== null) {
                conv.repliesDisabled = !profile.repliesEnabled;

                repliesUpdated = true;
            }

            if (profile.callSettings) {
                conv.callsMode = profile.callSettings.mode;
                conv.callLink = profile.callSettings.callLink;
                callSettingsUpdated = true;
            }

            if (profile.serviceMessageSettings) {
                conv.joinsMessageDisabled = !profile.serviceMessageSettings.joinsMessageEnabled;
                conv.leavesMessageDisabled = !profile.serviceMessageSettings.leavesMessageEnabled;
            }

            await conv.flush(ctx);

            return { updatedTitle, updatedPhoto, kindChanged, repliesUpdated, callSettingsUpdated };
        });
    }

    async pinMessage(parent: Context, cid: number, uid: number, mid: number) {
        return await inTx(parent, async (ctx) => {
            let conv = await Store.Conversation.findById(ctx, cid);
            let message = await Store.Message.findById(ctx, mid);
            if (!message || !conv || message.deleted) {
                throw new NotFoundError();
            }
            if (message.cid !== cid) {
                throw new AccessDeniedError();
            }

            if (conv.kind === 'private') {
                let privateConv = await Store.ConversationPrivate.findById(ctx, cid);
                if (!privateConv) {
                    throw new NotFoundError();
                }
                privateConv.pinnedMessage = mid;
                await privateConv.flush(ctx);
            } else if (conv.kind === 'room') {
                let profile = await Store.RoomProfile.findById(ctx, cid);
                if (!profile) {
                    throw new NotFoundError();
                }
                profile.pinnedMessage = mid;
                profile.pinnedMessageOwner = uid;
                await profile.flush(ctx);
            }

            Store.ConversationEventStore.post(ctx, message!.cid, ChatUpdatedEvent.create({
                cid,
                uid
            }));
            let userName = await Modules.Users.getUserFullName(ctx, uid);

            const getMessageContent: (msg: Message) => Promise<string> = async (msg: Message) => {
                let messageContent = 'DELETED';

                if (msg.text) {
                    let text = msg.text;
                    let parts = msg.text.split('\n');
                    let isMultiline = parts.length > 1;

                    if (isMultiline) {
                        text = parts[0];
                    }
                    if (text.length > 20) {
                        messageContent = smartSlice(text, 0, 20) + '...';
                    } else {
                        messageContent = text + (isMultiline ? '...' : '');
                    }
                } else if (msg.attachmentsModern) {
                    let file = msg.attachmentsModern.find(a => a.type === 'file_attachment') as MessageAttachmentFile;
                    let purchase = msg.attachmentsModern.find(a => a.type === 'purchase_attachment');
                    if (file && file.fileMetadata && file.fileMetadata.isImage && file.fileMetadata.mimeType === 'image/gif') {
                        messageContent = 'GIF';
                    } else if (file && file.fileMetadata && file.fileMetadata.isImage) {
                        messageContent = 'Photo';
                    } else if (file && file.fileMetadata) {
                        messageContent = 'Document';
                    } else if (purchase) {
                        messageContent = 'Donation';
                    }
                } else if (msg.replyMessages && msg.replyMessages.length > 0) {
                    let replyMsg = await Store.Message.findById(ctx, msg.replyMessages[0]);

                    if (replyMsg) {
                        return getMessageContent(replyMsg);
                    }
                }

                return messageContent;
            };

            await Modules.Messaging.sendMessage(ctx, cid, uid, {
                ...buildMessage(userMention(userName, uid), ' pinned “', boldString(await getMessageContent(message)), '”'),
                isService: true
            });
            return true;
        });
    }

    async unpinMessage(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let conv = await Store.Conversation.findById(ctx, cid);
            if (!conv) {
                throw new NotFoundError();
            }
            if (conv.kind === 'room') {
                let profile = await Store.RoomProfile.findById(ctx, cid);
                if (!profile) {
                    throw new NotFoundError();
                }
                if (!profile.pinnedMessage) {
                    return false;
                }

                profile.pinnedMessage = null;
                profile.pinnedMessageOwner = null;
                await profile.flush(ctx);
            } else if (conv.kind === 'private') {
                let privateConv = await Store.ConversationPrivate.findById(ctx, cid);
                if (!privateConv) {
                    throw new NotFoundError();
                }
                if (!privateConv.pinnedMessage) {
                    return false;
                }

                privateConv.pinnedMessage = null;
                await privateConv.flush(ctx);
            }

            Store.ConversationEventStore.post(ctx, cid, ChatUpdatedEvent.create({
                cid,
                uid
            }));
            return true;
        });
    }

    async updateMemberRole(parent: Context, cid: number, uid: number, updatedUid: number, role: 'admin' | 'owner' | 'member') {
        return await inTx(parent, async (ctx) => {
            let conv = await Store.RoomProfile.findById(ctx, cid);
            if (!conv) {
                throw new Error('Room not found');
            }
            let p2 = await Store.RoomParticipant.findById(ctx, cid, updatedUid);
            if (!p2 || p2.status !== 'joined') {
                throw new Error('User is not member of a room');
            }
            p2.role = role;
            return (await Store.Conversation.findById(ctx, conv.id))!;
        });
    }

    async moveRoom(parent: Context, cid: number, uid: number, toOrg: number) {
        return await inTx(parent, async (ctx) => {
            let room = await Store.ConversationRoom.findById(ctx, cid);
            if (!room) {
                throw new NotFoundError();
            }

            if (!(await this.userHaveAdminPermissionsInChat(ctx, room, uid))) {
                throw new AccessDeniedError();
            }
            let isSuper = (await Modules.Super.superRole(ctx, uid)) === 'super-admin';

            if (!(await Modules.Orgs.isUserAdmin(ctx, uid, toOrg)) && !isSuper) {
                throw new AccessDeniedError();
            }

            let prevOrg = room.oid;

            room.oid = toOrg;
            room.kind = 'public';
            await room.flush(ctx);

            // Reindex
            await Modules.Orgs.markForUndexing(ctx, toOrg);
            if (prevOrg) {
                await Modules.Orgs.markForUndexing(ctx, prevOrg);
            }
            let profile = await Store.RoomProfile.findById(ctx, cid);
            profile!.invalidate();
            await profile!.flush(ctx);

            return (await Store.Conversation.findById(ctx, cid))!;
        });
    }

    async deleteRoom(parent: Context, cid: number) {
        return await inTx(parent, async (ctx) => {
            let conv = await Store.Conversation.findById(ctx, cid);
            if (conv!.deleted) {
                return false;
            }
            conv!.deleted = true;
            await conv!.flush(ctx);

            let room = await Store.ConversationRoom.findById(ctx, cid);
            if (room) {
                room.isDeleted = true;
                await room.flush(ctx);
            }

            return true;
        });
    }

    async archiveRoom(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let room = await Store.ConversationRoom.findById(ctx, cid);

            if (!room) {
                throw new NotFoundError();
            }

            let conv = await Store.Conversation.findById(ctx, cid);
            if (conv!.archived) {
                return false;
            }
            conv!.archived = true;
            await conv!.flush(ctx);

            Store.ConversationEventStore.post(ctx, cid, ChatUpdatedEvent.create({
                cid,
                uid
            }));

            return true;
        });
    }

    //
    // Members
    //

    async setParticipant(ctx: Context, cid: number, uid: number, isMember: boolean, async: boolean) {
        let dir = Store.RoomParticipantsActiveDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);

        if (isMember) {
            dir.set(ctx, [cid, uid], false);
            this.userChats.addChat(ctx, uid, cid);
            await this.fastCounters.onAddDialog(ctx, uid, cid);
            await this.experimentalCounters.onAddDialog(ctx, uid, cid);
            await this.userReadSeqs.onAddDialog(ctx, uid, cid);
            this.chatMembers.addMember(ctx, cid, uid, async);
        } else {
            this.userChats.removeChat(ctx, uid, cid);
            this.fastCounters.onRemoveDialog(ctx, uid, cid);
            this.experimentalCounters.onRemoveDialog(ctx, uid, cid);
            await this.userReadSeqs.onRemoveDialog(ctx, uid, cid);
            this.chatMembers.removeMember(ctx, cid, uid);
            dir.clear(ctx, [cid, uid]);
        }
    }

    private async getParticipants(ctx: Context, cid: number) {
        let dir = Store.RoomParticipantsActiveDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);
        let items = await dir.range(ctx, [cid]);
        return items.map((v) => v.key[v.key.length - 1] as number);
    }

    //
    // Editorial
    //

    async setFeatured(parent: Context, cid: number, featued: boolean) {
        return await inTx(parent, async (ctx) => {
            let room = await Store.ConversationRoom.findById(ctx, cid);
            if (!room) {
                throw new AccessDeniedError();
            }
            room.featured = featued;
            let profile = await Store.RoomProfile.findById(ctx, cid);
            profile!.invalidate(); // Update profile for reindexing
            return (await Store.Conversation.findById(ctx, cid))!;
        });
    }

    async setListed(parent: Context, cid: number, listed: boolean) {
        return await inTx(parent, async (ctx) => {
            let room = await Store.ConversationRoom.findById(ctx, cid);
            if (!room) {
                throw new AccessDeniedError();
            }
            room.listed = room.kind === 'public' && listed;
            let profile = await Store.RoomProfile.findById(ctx, cid);
            profile!.invalidate(); // Update profile for reindexing
            return (await Store.Conversation.findById(ctx, cid))!;
        });
    }

    async setupAutosubscribe(parent: Context, cid: number, childIds: number[]) {
        return await inTx(parent, async (ctx) => {
            let room = await Store.ConversationRoom.findById(ctx, cid);
            if (!room) {
                throw new AccessDeniedError();
            }
            for (let id of childIds) {
                let child = await Store.ConversationRoom.findById(ctx, id);
                if (!child || child.isDeleted) {
                    throw new NotFoundError();
                }
            }
            room.autosubscribeRooms = childIds;
            return (await Store.Conversation.findById(ctx, cid))!;
        });
    }

    //
    // Queries
    //

    async checkRoomExists(ctx: Context, cid: number) {
        let conv = await Store.ConversationRoom.findById(ctx, cid);
        if (!conv) {
            throw new Error('Room not found');
        }
    }

    async isActiveMember(ctx: Context, uid: number, cid: number) {
        let p = await Store.RoomParticipant.findById(ctx, cid, uid);
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
        let p = await Store.RoomParticipant.findById(ctx, cid, uid);
        if (!p) {
            return null;
        }
        return p;
    }

    async resolveUserMembershipStatus(ctx: Context, uid: number, cid: number) {
        let participant = await Store.RoomParticipant.findById(ctx, cid, uid);
        return participant ? participant.status : 'none';
    }

    async resolveUserRole(ctx: Context, uid: number, cid: number) {
        let participant = await Store.RoomParticipant.findById(ctx, cid, uid);
        return participant ? participant.role : 'MEMBER';
    }

    async findActiveMembers(ctx: Context, cid: number) {
        return Store.RoomParticipant.active.findAll(ctx, cid);
    }

    async roomMembersCount(ctx: Context, conversationId: number, status?: string): Promise<number> {
        if (!status || status === 'joined') {
            let profile = await Store.RoomProfile.findById(ctx, conversationId);
            return (profile && profile.activeMembersCount) || 0;
        }
        return (await Store.RoomParticipant.active.findAll(ctx, conversationId)).filter(m => status === undefined || m.status === status).length;
    }

    async resolvePrivateChat(parent: Context, uid1: number, uid2: number) {
        return await inTx(parent, async (ctx) => {
            let conv = await Store.ConversationPrivate.users.find(ctx, Math.min(uid1, uid2), Math.max(uid1, uid2));
            let created = false;
            if (!conv) {
                let id = await this.fetchNextConversationId(ctx);
                await (await Store.Conversation.create(ctx, id, { kind: 'private' })).flush(ctx);
                conv = await Store.ConversationPrivate.create(ctx, id, {
                    uid1: Math.min(uid1, uid2),
                    uid2: Math.max(uid1, uid2)
                });
                this.metrics.onChatCreated(ctx, uid1);
                this.metrics.onChatCreated(ctx, uid2);
                await this.fastCounters.onAddDialog(ctx, uid1, conv.id);
                await this.fastCounters.onAddDialog(ctx, uid2, conv.id);
                await this.experimentalCounters.onAddDialog(ctx, uid1, conv.id);
                await this.experimentalCounters.onAddDialog(ctx, uid2, conv.id);
                await this.userReadSeqs.onAddDialog(ctx, uid1, conv.id);
                await this.userReadSeqs.onAddDialog(ctx, uid2, conv.id);
                await conv.flush(ctx);
                created = true;
            }
            return { conv: (await Store.Conversation.findById(ctx, conv.id))!, created };
        });
    }

    async hasPrivateChat(parent: Context, uid1: number, uid2: number) {
        let conv = await Store.ConversationPrivate.users.find(parent, Math.min(uid1, uid2), Math.max(uid1, uid2));
        if (conv) {
            let message = await Store.Message.chat.query(parent, conv.id, { limit: 1 });
            return message.items.length === 1;
        }
        return !!conv;
    }

    async resolveOrganizationChat(parent: Context, oid: number) {
        return await inTx(parent, async (ctx) => {
            let conv = await Store.ConversationOrganization.organization.find(ctx, oid);
            if (!conv) {
                let id = await this.fetchNextConversationId(ctx);
                await (await Store.Conversation.create(ctx, id, { kind: 'organization' })).flush(ctx);
                conv = await Store.ConversationOrganization.create(ctx, id, { oid });
                await conv.flush(ctx);
            }
            return (await Store.Conversation.findById(ctx, conv.id))!;
        });
    }

    async resolveConversationOrganization(ctx: Context, cid: number) {
        //
        // Legacy organization-type conversations
        //
        let conversationOrganization = await Store.ConversationOrganization.findById(ctx, cid);
        if (conversationOrganization) {
            return await Store.Organization.findById(ctx, conversationOrganization.oid);
        }

        //
        //  Modern rooms
        //
        let room = await Store.ConversationRoom.findById(ctx, cid);
        if (room && room.oid) {
            return await Store.Organization.findById(ctx, room.oid);
        }

        return null;
    }

    async isPrivate(ctx: Context, cid: number, uid: number): Promise<number | false> {
        let conv = await Store.Conversation.findById(ctx, cid);
        if (!conv) {
            return false;
        }
        if (conv.kind !== 'private') {
            return false;
        }
        let p = (await Store.ConversationPrivate.findById(ctx, cid))!;
        if (p.uid1 === uid) {
            return p.uid2;
        }
        if (p.uid2 === uid) {
            return p.uid1;
        }
        return false;
    }

    async findConversationMembers(ctx: Context, cid: number): Promise<number[]> {
        let conv = await Store.Conversation.findById(ctx, cid);
        if (!conv) {
            return [];
        }
        if (conv.kind === 'private') {
            let p = (await Store.ConversationPrivate.findById(ctx, cid))!;
            return [p.uid1, p.uid2];
        } else if (conv.kind === 'room') {
            // This cache might not mark records as read and therefore transactional guarantees
            // a void, but it seems that we are using this code mostly in workers and resolvers
            let version = await Store.RoomParticipantsVersion.get(ctx, cid);
            let cached = this.membersCache.get(`${cid}_${version}`);
            if (cached) {
                return cached;
            }
            // let loaded = (await Store.RoomParticipant.active.findAll(ctx, cid)).map((v) => v.uid);
            let loaded = await this.getParticipants(ctx, cid);
            this.membersCache.save(`${cid}_${version}`, loaded);
            return loaded;
        } else if (conv.kind === 'organization') {
            if (conv.deleted) {
                return [];
            }
            let org = (await Store.ConversationOrganization.findById(ctx, cid))!;
            return (await Store.OrganizationMember.organization.findAll(ctx, 'joined', org.oid)).map((v) => v.uid);
        } else {
            throw new Error('Internal error');
        }
    }

    async isSuperGroup(ctx: Context, cid: number): Promise<boolean> {
        let conv = await Store.Conversation.findById(ctx, cid);
        if (conv && conv.kind === 'room') {
            return true;
        } else {
            return false;
        }
    }

    async resolveConversationTitle(ctx: Context, conversationId: number, uid: number): Promise<string> {
        let conv = await Store.Conversation.findById(ctx, conversationId);

        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }

        if (conv.kind === 'private') {
            let p = (await Store.ConversationPrivate.findById(ctx, conv.id))!;
            let _uid;
            if (p.uid1 === uid) {
                _uid = p.uid2;
            } else if (p.uid2 === uid) {
                _uid = p.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await Store.UserProfile.findById(ctx, _uid))!;
            if (!profile) {
                return 'DELETED';
            }
            return [profile.firstName, profile.lastName].filter((v) => !!v).join(' ');
        } else if (conv.kind === 'organization') {
            let o = await Store.ConversationOrganization.findById(ctx, conv.id);
            return (await Store.OrganizationProfile.findById(ctx, o!.oid))!.name;
        } else {
            let r = (await Store.ConversationRoom.findById(ctx, conv.id))!;
            let p = (await Store.RoomProfile.findById(ctx, conv.id))!;
            if (r.kind === 'group') {
                if (p.title !== '') {
                    return p.title;
                }
                let res = (await Store.RoomParticipant.active.findAll(ctx, conv.id)).filter((v) => v.uid !== uid);
                let name: string[] = [];
                for (let r2 of res) {
                    let p2 = (await Store.UserProfile.findById(ctx, r2.uid))!;
                    name.push([p2.firstName, p2.lastName].filter((v) => !!v).join(' '));
                }
                return name.join(', ');
            }
            return p.title;
        }
    }

    async resolveConversationPhoto(ctx: Context, conversationId: number, uid: number): Promise<string> {
        let conv = await Store.Conversation.findById(ctx, conversationId);

        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }

        if (conv.kind === 'private') {
            let p = (await Store.ConversationPrivate.findById(ctx, conv.id))!;
            let _uid;
            if (p.uid1 === uid) {
                _uid = p.uid2;
            } else if (p.uid2 === uid) {
                _uid = p.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await Store.UserProfile.findById(ctx, _uid))!;
            if (!profile) {
                return 'ph://' + doSimpleHash(IDs.User.serialize(_uid)) % 6;
            }
            let res = buildBaseImageUrl(profile.picture);
            if (res) {
                return res;
            } else {
                return 'ph://' + doSimpleHash(IDs.User.serialize(_uid)) % 6;
            }
        } else if (conv.kind === 'organization') {
            let o = await Store.ConversationOrganization.findById(ctx, conv.id);
            let res = buildBaseImageUrl((await Store.OrganizationProfile.findById(ctx, o!.oid))!.photo);
            if (res) {
                return res;
            } else {
                return 'ph://' + doSimpleHash(IDs.Organization.serialize(o!.oid)) % 6;
            }
        } else {
            let p = (await Store.RoomProfile.findById(ctx, conv.id))!;
            let res = buildBaseImageUrl(p.image);
            if (res) {
                return res;
            } else {
                return 'ph://' + doSimpleHash(IDs.Conversation.serialize(conv.id)) % 6;
            }
        }
    }

    async resolveConversationSocialImage(ctx: Context, conversationId: number): Promise<string | null> {
        let conv = await Store.Conversation.findById(ctx, conversationId);

        if (!conv) {
            throw new NotFoundError('Conversation not found');
        }

        let profile = await Store.RoomProfile.findById(ctx, conv.id);
        return profile ? buildBaseImageUrl(profile.socialImage) : null;
    }

    async resolveConversationWelcomeMessage(ctx: Context, conversationId: number): Promise<WelcomeMessageT | null> {
        let profile = await Store.RoomProfile.findById(ctx, conversationId);
        if (!profile) {
            return null;
        }

        const senderId = profile.welcomeMessageSender ? profile.welcomeMessageSender : null;
        let sender = null;

        if (senderId) {
            sender = await Store.User.findById(ctx, senderId);

            if (!sender) {
                sender = null;
            }
        }

        const isOn = !!profile.welcomeMessageIsOn;
        const message = profile.welcomeMessageText || '';

        return {
            type: 'WelcomeMessage',
            isOn,
            sender,
            message
        };
    }

    async resolveConversationWelcomeMessageText(ctx: Context, conversationId: number): Promise<string | null> {
        let profile = await Store.RoomProfile.findById(ctx, conversationId);
        if (!profile) {
            throw new NotFoundError();
        }
        return profile.welcomeMessageText;
    }

    async updateWelcomeMessage(parent: Context, cid: number, welcomeMessageIsOn: boolean, welcomeMessageSender: number | null | undefined, welcomeMessageText: string | null | undefined) {
        return await inTx(parent, async (ctx) => {
            let profile = await Store.RoomProfile.findById(ctx, cid);
            if (!profile) {
                throw new NotFoundError();
            }

            profile.welcomeMessageIsOn = welcomeMessageIsOn;
            if (welcomeMessageSender !== undefined) {
                profile.welcomeMessageSender = welcomeMessageSender;
            }

            if (welcomeMessageText !== undefined) {
                profile.welcomeMessageText = welcomeMessageText;
            }

            await profile.flush(ctx);
            return true;
        });
    }

    async userHaveAdminPermissionsInChat(ctx: Context, conv: ConversationRoom, uid: number) {
        //
        // No one have access to deleted chat
        //
        let conversation = await Store.Conversation.findById(ctx, conv.id);
        if (conversation && conversation.deleted) {
            return false;
        }

        //
        //  Super-admin can do everything (again)
        //
        if ((await Modules.Super.superRole(ctx, uid)) === 'super-admin') {
            return true;
        }

        //
        //  Org/community admin can manage any chat in that org/community
        //
        if (conv.oid && (await Modules.Orgs.isUserAdmin(ctx, uid, conv.oid))) {
            return true;
        }

        //
        //  Group owner can manage chat
        //
        if (conv.ownerId === uid) {
            return true;
        }

        //
        //  Group admin can manage chat
        //
        let userRole = await this.resolveUserRole(ctx, uid, conv.id);
        if (userRole === 'admin' || userRole === 'owner') {
            return true;
        }

        return false;
    }

    async checkAccess(ctx: Context, uid: number, cid: number) {
        let conv = await Store.Conversation.findById(ctx, cid);
        if (!conv) {
            throw new AccessDeniedError();
        }
        if (conv.kind === 'private') {
            let p = await Store.ConversationPrivate.findById(ctx, cid);
            if (!p) {
                throw new AccessDeniedError();
            }
            if (p.uid1 !== uid && p.uid2 !== uid) {
                throw new AccessDeniedError();
            }
            let targetUid: number;
            if (p.uid1 === uid) {
                targetUid = p.uid2;
            } else {
                targetUid = p.uid1;
            }
            if (await Modules.BlackListModule.isUserBanned(ctx, uid, targetUid)) {
                throw new AccessDeniedError();
            }
            if (await Modules.BlackListModule.isUserBanned(ctx, targetUid, uid)) {
                throw new AccessDeniedError();
            }
        } else if (conv.kind === 'room') {
            let convRoom = await Store.ConversationRoom.findById(ctx, cid);

            let member = await Store.RoomParticipant.findById(ctx, cid, uid);
            if (!member || member.status !== 'joined') {
                throw new AccessDeniedError();
            }

            if (convRoom && await this.userHaveAdminPermissionsInChat(ctx, convRoom, uid)) {
                return;
            }
        } else if (conv.kind === 'organization') {
            let org = await Store.ConversationOrganization.findById(ctx, cid);
            if (!org) {
                throw new AccessDeniedError();
            }
            if (conv.deleted) {
                throw new AccessDeniedError();
            }
            let member = await Store.OrganizationMember.findById(ctx, org.oid, uid);
            if (!member || member.status !== 'joined') {
                throw new AccessDeniedError();
            }
        } else {
            throw new AccessDeniedError();
        }
    }

    async canUserSeeChat(ctx: Context, uid: number, cid: number) {
        try {
            await this.checkCanUserSeeChat(ctx, uid, cid);
            return true;
        } catch (e) {
            return false;
        }
    }

    async checkCanUserSeeChat(ctx: Context, uid: number, cid: number) {
        let conv = await Store.Conversation.findById(ctx, cid);
        if (!conv) {
            throw new AccessDeniedError();
        }
        if (conv.kind === 'private') {
            let p = await Store.ConversationPrivate.findById(ctx, cid);
            if (!p) {
                throw new AccessDeniedError();
            }
            if (p.uid1 !== uid && p.uid2 !== uid) {
                throw new AccessDeniedError();
            }
        } else if (conv.kind === 'room') {
            let conversation = (await Store.ConversationRoom.findById(ctx, cid))!;
            let member = await Store.RoomParticipant.findById(ctx, cid, uid);
            let isMember = member && member.status === 'joined';

            if (isMember) {
                return;
            }

            //
            // No one can see deleted chat
            //
            if (conversation.isDeleted) {
                throw new AccessDeniedError();
            }

            //
            //  User can see secret chat only if he is a member
            //
            if (conversation.kind === 'group') {
                throw new AccessDeniedError();
            } else if (conversation.kind === 'public' && conversation.oid) {
                //
                //   User can see organization group only if he is a member of org
                //   User can see any community group
                //
                let org = (await Store.Organization.findById(ctx, conversation.oid))!;
                if (org.kind === 'organization') {
                    if (!await Modules.Orgs.isUserMember(ctx, uid, org.id)) {
                        throw new AccessDeniedError();
                    }
                } else if (org.kind === 'community' && org.private) {
                    if (!await Modules.Orgs.isUserMember(ctx, uid, org.id)) {
                        throw new AccessDeniedError();
                    }

                }
            }
        } else if (conv.kind === 'organization') {
            let org = await Store.ConversationOrganization.findById(ctx, cid);
            if (!org) {
                throw new AccessDeniedError();
            }
            let member = await Store.OrganizationMember.findById(ctx, org.oid, uid);
            if (!member || member.status !== 'joined') {
                throw new AccessDeniedError();
            }
        } else {
            throw new AccessDeniedError();
        }
    }

    async userWasKickedFromRoom(ctx: Context, uid: number, cid: number): Promise<boolean> {
        let conv = await Store.Conversation.findById(ctx, cid);
        if (!conv || (conv.kind !== 'room' && conv.kind !== 'organization')) {
            return false;
        }

        if (conv.kind === 'organization') {
            let org = (await Store.ConversationOrganization.findById(ctx, cid))!;
            let orgMember = await Store.OrganizationMember.findById(ctx, org.oid, uid);

            if (orgMember && orgMember.status === 'left') {
                return true;
            } else {
                return false;
            }
        } else if (conv.kind === 'room') {
            let member = await Store.RoomParticipant.findById(ctx, cid, uid);
            let room = await Store.ConversationRoom.findById(ctx, cid);

            if (member && room && (member.status === 'kicked' || (room.kind === 'group' && member.status === 'left'))) {
                return true;
            } else {
                return false;
            }
        }

        throw new NotFoundError();
    }

    //
    // Internals
    //

    private async fetchNextConversationId(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let sequence = await Store.Sequence.findById(ctx, 'conversation-id');
            if (!sequence) {
                sequence = (await Store.Sequence.create(ctx, 'conversation-id', { value: 0 }));
                await sequence.flush(ctx);
            }
            return ++sequence.value;
        });
    }

    private async createRoomParticipant(parent: Context, cid: number, uid: number, data: RoomParticipantCreateShape) {
        return await inTx(parent, async ctx => {
            let roomProfile = await Store.RoomProfile.findById(ctx, cid);
            if (!roomProfile) {
                throw new NotFoundError();
            }

            if (data.status === 'joined') {
                await this.incrementRoomActiveMembers(ctx, cid);
            }

            return await Store.RoomParticipant.create(ctx, cid, uid, data);
        });
    }

    private async incrementRoomActiveMembers(parent: Context, cid: number) {
        return await inTx(parent, async ctx => {
            let roomProfile = await Store.RoomProfile.findById(ctx, cid);
            if (!roomProfile) {
                throw new NotFoundError();
            }

            if (!roomProfile.activeMembersCount) {
                roomProfile.activeMembersCount = 1;
            } else {
                roomProfile.activeMembersCount++;
            }
            await Modules.Hooks.onChatMembersCountChange(ctx, cid, 1);
        });
    }

    private async decrementRoomActiveMembers(parent: Context, cid: number) {
        return await inTx(parent, async ctx => {
            let roomProfile = await Store.RoomProfile.findById(ctx, cid);
            if (!roomProfile) {
                throw new NotFoundError();
            }

            if (roomProfile.activeMembersCount) {
                roomProfile.activeMembersCount--;
            }
            await Modules.Hooks.onChatMembersCountChange(ctx, cid, -1);
        });
    }

    async isPublicCommunityChat(ctx: Context, cid: number) {
        let chat = await Store.Conversation.findById(ctx, cid);
        if (!chat || chat.kind !== 'room') {
            return false;
        }
        let room = (await Store.ConversationRoom.findById(ctx, cid))!;
        if (room.kind !== 'public' || !room.oid) {
            return false;
        }
        let org = await Store.Organization.findById(ctx, room.oid);
        if (!org || org.kind !== 'community' || org.private) {
            return false;
        }
        return true;
    }
}
