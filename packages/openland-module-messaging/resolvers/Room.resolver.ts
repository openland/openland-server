import { ChannelInvitation, ChannelLink, UserDialogSettings, Conversation, RoomProfile, RoomParticipant } from './../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import {
    withAccount,
    withUser,
    withPermission,
    withActivatedUser,
    withAny,
    withAuthFallback
} from 'openland-module-api/Resolvers';
import { IdsFactory, IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { IDMailformedError } from 'openland-errors/IDMailformedError';
import { Store } from 'openland-module-db/FDB';
import {
    Message
} from '../../openland-module-db/store';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { validate, defined, stringNotEmpty, enumString, optional, mustBeArray, emailValidator } from 'openland-utils/NewInputValidator';
import { AppContext } from 'openland-modules/AppContext';
import { MessageMention } from '../MessageInput';
import { MaybePromise } from '../../openland-module-api/schema/SchemaUtils';

type RoomRoot = Conversation | number;

function withConverationId<T, R>(handler: (ctx: AppContext, src: number, args: T, showPlaceholder: boolean) => MaybePromise<R>) {
    return async (src: RoomRoot, args: T, ctx: AppContext) => {
        if (typeof src === 'number') {
            let showPlaceholder = ctx.auth!.uid ? await Modules.Messaging.room.userWasKickedFromRoom(ctx, ctx.auth!.uid!, src) : false;
            return handler(ctx, src, args, showPlaceholder);
        } else {
            let showPlaceholder = ctx.auth!.uid ? await Modules.Messaging.room.userWasKickedFromRoom(ctx, ctx.auth!.uid!, src.id) : false;
            return handler(ctx, src.id, args, showPlaceholder);
        }
    };
}

function withRoomProfile(handler: (ctx: AppContext, src: RoomProfile | null, showPlaceholder: boolean) => any) {
    return async (src: RoomRoot, args: {}, ctx: AppContext) => {
        if (typeof src === 'number') {
            let showPlaceholder = ctx.auth!.uid ? await Modules.Messaging.room.userWasKickedFromRoom(ctx, ctx.auth!.uid!, src) : false;
            return handler(ctx, (await Store.RoomProfile.findById(ctx, src)), showPlaceholder);
        } else {
            let showPlaceholder = ctx.auth!.uid ? await Modules.Messaging.room.userWasKickedFromRoom(ctx, ctx.auth!.uid!, src.id) : false;
            return handler(ctx, (await Store.RoomProfile.findById(ctx, src.id)), showPlaceholder);
        }
    };
}

export default {
    Room: {
        __resolveType: async (src: Conversation | number, ctx: AppContext) => {
            let conv: Conversation;
            if (typeof src === 'number') {
                conv = (await Store.Conversation.findById(ctx, src))!;
            } else {
                conv = src;
            }
            if (conv.kind === 'private') {
                return 'PrivateRoom';
            } else {
                return 'SharedRoom';
            }
        }
    },
    PrivateRoom: {
        id: (root: RoomRoot) => IDs.Conversation.serialize(typeof root === 'number' ? root : root.id),
        user: async (root: RoomRoot, args: {}, parent: AppContext) => {
            // In some cases we can't get ConversationPrivate here because it's not available in previous transaction, so we create new one
            return await inTx(parent, async (ctx) => {
                let proom = (await Store.ConversationPrivate.findById(ctx, typeof root === 'number' ? root : root.id))!;
                if (proom.uid1 === parent.auth.uid!) {
                    return proom.uid2;
                } else if (proom.uid2 === parent.auth.uid!) {
                    return proom.uid1;
                } else {
                    throw new AccessDeniedError();
                }
            });
        },
        settings: async (root: RoomRoot, args: {}, ctx: AppContext) => await Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!, (typeof root === 'number' ? root : root.id)),
        pinnedMessage: async (root, args, ctx) => {
            let proom = (await Store.ConversationPrivate.findById(ctx, typeof root === 'number' ? root : root.id))!;
            if (proom.pinnedMessage) {
                return await Store.Message.findById(ctx, proom.pinnedMessage);
            } else {
                return null;
            }
        },
        myBadge: (root: RoomRoot, args: {}, ctx: AppContext) => Modules.Users.getUserBadge(ctx, ctx.auth.uid!, (typeof root === 'number' ? root : root.id)),
    },
    SharedRoomMembershipStatus: {
        MEMBER: 'joined',
        REQUESTED: 'requested',
        LEFT: 'left',
        KICKED: 'kicked',
        NONE: 'none',
    },
    SharedRoom: {
        id: (root: RoomRoot) => IDs.Conversation.serialize(typeof root === 'number' ? root : root.id),
        kind: withConverationId(async (ctx, id) => {
            let room = (await Store.ConversationRoom.findById(ctx, id))!;
            // temp fix resolve openland internal chat
            let conveOrg = (await Store.ConversationOrganization.findById(ctx, id))!;
            if (!room && conveOrg) {
                return 'INTERNAL';
            }

            if (room.kind === 'group') {
                return 'GROUP';
            } else if (room.kind === 'internal') {
                return 'INTERNAL';
            } else if (room.kind === 'public') {
                return 'PUBLIC';
            } else if (room.kind === 'organization') {
                return 'INTERNAL';
            } else {
                throw Error('Unknown room kind: ' + room.kind);
            }
        }),
        isChannel: withConverationId(async (ctx, id) => {
            let room = await Store.ConversationRoom.findById(ctx, id);
            return !!(room && room.isChannel);
        }),
        isPaid: withConverationId(async (ctx, id) => {
            let room = await Store.ConversationRoom.findById(ctx, id);
            return !!(room && room.isPaid);
        }),
        paidPassIsActive: withAuthFallback(withConverationId(async (ctx, id) => {
            let pass = ctx.auth.uid && await Store.PaidChatUserPass.findById(ctx, id, ctx.auth.uid);
            return !!(pass && pass.isActive);
        }), false),
        paymentSettings: withAuthFallback(withConverationId(async (ctx, id) => {
            let paidChatSettings = await Store.PaidChatSettings.findById(ctx, id);
            return paidChatSettings && { id, price: paidChatSettings.price, strategy: paidChatSettings.strategy === 'one-time' ? 'ONE_TIME' : 'SUBSCRIPTION' };
        }), null),
        canSendMessage: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? false : !!(await Modules.Messaging.room.checkCanSendMessage(ctx, id, ctx.auth.uid!))), false),
        title: withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? 'Deleted' : Modules.Messaging.room.resolveConversationTitle(ctx, id, ctx.auth.uid!)),
        photo: withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? 'ph://1' : Modules.Messaging.room.resolveConversationPhoto(ctx, id, ctx.auth.uid!)),
        socialImage: withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? null : Modules.Messaging.room.resolveConversationSocialImage(ctx, id)),
        organization: withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? null : Modules.Messaging.room.resolveConversationOrganization(ctx, id)),

        description: withRoomProfile((ctx, profile, showPlaceholder) => showPlaceholder ? null : (profile && profile.description)),
        welcomeMessage: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? null : await Modules.Messaging.room.resolveConversationWelcomeMessage(ctx, id)), null),

        pinnedMessage: withAuthFallback(withRoomProfile((ctx, profile, showPlaceholder) => showPlaceholder ? null : (profile && profile.pinnedMessage && Store.Message.findById(ctx, profile.pinnedMessage))), null),

        membership: withConverationId(async (ctx, id, args, showPlaceholder) => (showPlaceholder ? 'none' : (ctx.auth.uid ? await Modules.Messaging.room.resolveUserMembershipStatus(ctx, ctx.auth.uid, id) : 'none')) as any),
        role: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? 'MEMBER' : (await Modules.Messaging.room.resolveUserRole(ctx, ctx.auth.uid!, id)).toUpperCase()), 'MEMBER'),
        membersCount: withRoomProfile((ctx, profile, showPlaceholder) => showPlaceholder ? 0 : (profile && profile.activeMembersCount) || 0),
        onlineMembersCount: withConverationId(async (ctx, id, args, showPlaceholder) => {
            if (showPlaceholder) {
                return 0;
            }
            let onlineCount = 0;
            let members = (await Modules.Messaging.room.findConversationMembers(ctx, id));
            let membersOnline = await Promise.all(members.map(m => Store.Online.findById(ctx, m)));
            for (let online of membersOnline) {
                if (online && online.lastSeen > Date.now()) {
                    onlineCount++;
                }
            }
            return onlineCount;
        }),
        previewMembers: withConverationId(async (ctx, id, args, showPlaceholder) => {
            if (showPlaceholder) {
                return [];
            }
            let members = (await Store.RoomParticipant.active.query(ctx, id, { limit: 5 })).items;
            return members.map(m => m.uid);
        }),
        members: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => {
            if (showPlaceholder) {
                return [];
            }
            let afterMember: RoomParticipant | null = null;
            if (args.after) {
                afterMember = await Store.RoomParticipant.findById(ctx, id, IDs.User.parse(args.after));
            }
            if (afterMember) {
                return (await Store.RoomParticipant.active.query(ctx, id, { after: afterMember.uid, limit: args.first || 1000 })).items;
            }

            return (await Store.RoomParticipant.active.query(ctx, id, { limit: args.first || 1000 })).items;
        }), []),
        requests: withAuthFallback(withConverationId(async (ctx, id) => ctx.auth.uid && await Modules.Messaging.room.resolveRequests(ctx, ctx.auth.uid, id)), []),
        settings: withAuthFallback(async (root: RoomRoot, args: {}, ctx: AppContext) => await Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!, (typeof root === 'number' ? root : root.id)), { cid: 0, mute: true }),
        canEdit: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? false : await Modules.Messaging.room.canEditRoom(ctx, id, ctx.auth.uid!)), false),
        archived: withAuthFallback(withConverationId(async (ctx, id, args) => {
            let conv = await Store.Conversation.findById(ctx, id);
            if (conv && conv.archived) {
                return true;
            } else {
                return false;
            }
        }), false),
        myBadge: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? null : await Modules.Users.getUserBadge(ctx, ctx.auth.uid!, id)), null),
        featuredMembersCount: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => (await Store.UserRoomBadge.chat.findAll(ctx, id)).length), 0),
        matchmaking: withAuthFallback(withConverationId(async (ctx, id) => await Modules.Matchmaking.getRoom(ctx, id, 'room')), null),
    },
    RoomMessage: {
        id: (src: Message) => {
            return IDs.ConversationMessage.serialize(src.id);
        },
        message: (src: Message) => src.text,
        file: (src: Message) => src.fileId as any,
        fileMetadata: (src: Message) => {
            if (src.fileId && src.fileMetadata) {
                return {
                    name: src.fileMetadata.name,
                    mimeType: src.fileMetadata.mimeType,
                    isImage: !!(src.fileMetadata.isImage),
                    imageWidth: src.fileMetadata.imageWidth,
                    imageHeight: src.fileMetadata.imageHeight,
                    imageFormat: src.fileMetadata.imageFormat,
                    size: src.fileMetadata.size
                };
            } else {
                return null;
            }
        },
        filePreview: (src: Message) => null,
        sender: (src: Message, _: any, ctx: AppContext) => Store.User.findById(ctx, src.uid),
        date: (src: Message) => src.metadata.createdAt,
        repeatKey: (src: Message, args: any, ctx: AppContext) => src.uid === ctx.auth.uid ? src.repeatKey : null,
        isService: (src: Message) => src.isService,
        serviceMetadata: (src: Message) => {
            if (src.serviceMetadata && (src.serviceMetadata as any).type) {
                return src.serviceMetadata;
            }

            return null;
        },
        urlAugmentation: (src: Message) => src.augmentation || null,
        edited: (src: Message) => (src.edited) || false,
        reactions: (src: Message) => src.reactions || [],
        replyMessages: async (src: Message, args: {}, ctx: AppContext) => {
            if (src.replyMessages) {
                let messages = await Promise.all((src.replyMessages as number[]).map(id => Store.Message.findById(ctx, id)));
                let filtered = messages.filter(m => !!m);
                if (filtered.length > 0) {
                    return filtered;
                }
                return null;
            }
            return null;
            // return src.replyMessages ? (src.replyMessages as number[]).map(id => FDB.Message.findById(id)).filter(m => !!m) : [];
        },
        plainText: async (src: Message) => null,
        mentions: async (src: Message, args: {}, ctx: AppContext) => src.mentions ? (src.mentions as number[]).map(id => Store.User.findById(ctx, id)) : null,

        alphaAttachments: async (src: Message) => {
            let attachments: { fileId: string, fileMetadata: any, filePreview?: string | null }[] = [];

            if (src.fileId) {
                attachments.push({
                    fileId: src.fileId,
                    fileMetadata: src.fileMetadata,
                    filePreview: src.filePreview
                });
            }

            if (src.attachments) {
                attachments.push(...src.attachments);
            }

            return attachments;
        },
        alphaButtons: async (src: Message) => src.buttons ? src.buttons : [],
        alphaType: async (src: Message) => src.type ? src.type : 'MESSAGE',
        alphaPostType: async (src: Message) => src.postType,
        alphaTitle: async (src: Message) => src.title,
        alphaMentions: async (src: Message) => src.complexMentions
    },
    RoomMember: {
        user: async (src: RoomParticipant, args: {}, ctx: AppContext) => await Store.User.findById(ctx, src.uid),
        role: async (src: RoomParticipant) => src.role.toUpperCase(),
        membership: async (src: RoomParticipant, args: {}, ctx: AppContext) => src.status as any,
        invitedBy: async (src: RoomParticipant, args: {}, ctx: AppContext) => src.invitedBy,
        canKick: async (src, args, ctx) => await Modules.Messaging.room.canKickFromRoom(ctx, src.cid, ctx.auth.uid!, src.uid),
        badge: (src: RoomParticipant, args: {}, ctx: AppContext) => Modules.Users.getUserBadge(ctx, src.uid, src.cid),
    },

    RoomInvite: {
        id: (src: ChannelInvitation | ChannelLink) => src.id,
        room: (src: ChannelInvitation | ChannelLink, args: {}, ctx: AppContext) => Store.Conversation.findById(ctx, src.channelId),
        invitedByUser: (src: ChannelInvitation | ChannelLink, args: {}, ctx: AppContext) => Store.User.findById(ctx, src.creatorId)
    },

    RoomUserNotificaionSettings: {
        id: (src: UserDialogSettings) => IDs.ConversationSettings.serialize(src.cid),
        mute: (src: UserDialogSettings) => src.mute
    },

    RoomSuper: {
        id: (root: RoomRoot) => IDs.Conversation.serialize(typeof root === 'number' ? root : root.id),
        featured: withConverationId(async (ctx, id) => {
            let room = await Store.ConversationRoom.findById(ctx, id);
            return !!(room && room.featured);
        }),
        listed: withConverationId(async (ctx, id) => {
            let room = await Store.ConversationRoom.findById(ctx, id);
            return !!(room && room.listed);
        }),
    },

    MessageAttachment: {
        fileId: src => src.fileId,
        filePreview: src => src.filePreview,
        fileMetadata: src => {
            if (src.fileId && src.fileMetadata) {
                return {
                    name: src.fileMetadata.name,
                    mimeType: src.fileMetadata.mimeType,
                    isImage: !!(src.fileMetadata.isImage),
                    imageWidth: src.fileMetadata.imageWidth,
                    imageHeight: src.fileMetadata.imageHeight,
                    imageFormat: src.fileMetadata.imageFormat,
                    size: src.fileMetadata.size
                };
            } else {
                return null;
            }
        }
    },

    Mention: {
        __resolveType(obj: MessageMention) {
            if (obj.type === 'User') {
                return 'UserMention';
            } else if (obj.type === 'SharedRoom') {
                return 'SharedRoomMention';
            }

            throw new Error('Unknown mention type');
        }
    },

    UserMention: {
        user: (src, _, ctx) => Modules.Users.profileById(ctx, src.id)
    },

    SharedRoomMention: {
        sharedRoom: (src, _, ctx) => Store.ConversationRoom.findById(ctx, src.id)
    },

    SharedRoomConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },

    Query: {
        room: withAccount(async (ctx, args, uid, oid) => {
            let id = IdsFactory.resolve(args.id);
            if (id.type === IDs.Conversation) {
                if (await Modules.Messaging.room.userWasKickedFromRoom(ctx, uid, id.id as number)) {
                    return id.id;
                } else {
                    await Modules.Messaging.room.checkCanUserSeeChat(ctx, uid, id.id as number);
                }
                return id.id;
            } else if (id.type === IDs.User) {
                return await Modules.Messaging.room.resolvePrivateChat(ctx, id.id as number, uid);
            } else if (id.type === IDs.Organization) {
                let member = await Store.OrganizationMember.findById(ctx, id.id as number, uid);
                if (!member || member.status !== 'joined') {
                    throw new IDMailformedError('Invalid id');
                }
                return Modules.Messaging.room.resolveOrganizationChat(ctx, id.id as number);
            } else {
                throw new IDMailformedError('Invalid id');
            }
        }),
        rooms: withAccount(async (ctx, args, uid, oid) => {
            let res = [];
            for (let idRaw of args.ids) {
                let id = IdsFactory.resolve(idRaw);
                if (id.type === IDs.Conversation) {
                    if (await Modules.Messaging.room.userWasKickedFromRoom(ctx, uid, id.id as number)) {
                        res.push(id.id);
                    } else {
                        await Modules.Messaging.room.checkCanUserSeeChat(ctx, uid, id.id as number);
                    }
                    res.push(id.id);
                } else if (id.type === IDs.User) {
                    res.push(await Modules.Messaging.room.resolvePrivateChat(ctx, id.id as number, uid));
                } else if (id.type === IDs.Organization) {
                    let member = await Store.OrganizationMember.findById(ctx, id.id as number, uid);
                    if (!member || member.status !== 'joined') {
                        throw new IDMailformedError('Invalid id');
                    }
                    res.push(Modules.Messaging.room.resolveOrganizationChat(ctx, id.id as number));
                } else {
                    throw new IDMailformedError('Invalid id');
                }
            }
            return res;
        }),
        roomSuper: withPermission('super-admin', async (ctx, args) => {
            return IdsFactory.resolve(args.id);
        }),
        roomMessages: withActivatedUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.roomId);
            await Modules.Messaging.room.checkAccess(ctx, uid, roomId);
            if (!args.first || args.first <= 0) {
                return [];
            }
            let beforeMessage: Message | null = null;
            if (args.before) {
                beforeMessage = await Store.Message.findById(ctx, IDs.ConversationMessage.parse(args.before));
            }

            if (beforeMessage) {
                return (await Store.Message.chat.query(ctx, roomId, { after: beforeMessage.id, limit: args.first!, reverse: true })).items;
            }

            return (await Store.Message.chat.query(ctx, roomId, { limit: args.first!, reverse: true })).items;
        }),
        roomMember: withActivatedUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.roomId);
            await Modules.Messaging.room.checkCanUserSeeChat(ctx, uid, roomId);
            let conversation = await Store.Conversation.findById(ctx, roomId);
            if (!conversation) {
                throw new Error('Room not found');
            }

            return await Store.RoomParticipant.findById(ctx, roomId, IDs.User.parse(args.memberId));
        }),
        roomMembers: withActivatedUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.roomId);
            await Modules.Messaging.room.checkCanUserSeeChat(ctx, uid, roomId);
            let conversation = await Store.Conversation.findById(ctx, roomId);
            if (!conversation) {
                throw new Error('Room not found');
            }
            if (conversation.kind === 'organization') {
                let convOrg = await Store.ConversationOrganization.findById(ctx, roomId);
                let members = await Store.OrganizationMember.organization.findAll(ctx, 'joined', convOrg!.oid);
                return members.map(m => ({
                    cid: roomId,
                    uid: m.uid,
                    role: 'member',
                    status: 'joined',
                }));
            } else {
                let afterMember: RoomParticipant | null = null;
                if (args.after) {
                    afterMember = await Store.RoomParticipant.findById(ctx, roomId, IDs.User.parse(args.after));
                }
                if (afterMember) {
                    return (await Store.RoomParticipant.active.query(ctx, roomId, { after: afterMember.uid, limit: args.first || 1000 })).items;
                }

                return (await Store.RoomParticipant.active.query(ctx, roomId, { limit: args.first || 1000 })).items;
            }
        }),
        roomFeaturedMembers: withActivatedUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.roomId);
            await Modules.Messaging.room.checkCanUserSeeChat(ctx, uid, roomId);
            let conversation = await Store.Conversation.findById(ctx, roomId);
            if (!conversation) {
                throw new Error('Room not found');
            }
            let badges = (await Store.UserRoomBadge.chat.query(ctx, roomId, { limit: args.first || 1000 })).items;
            return await Promise.all(badges.map(b => Store.RoomParticipant.findById(ctx, b.cid, b.uid)));
        }),

        betaRoomSearch: withActivatedUser(async (ctx, args, uid) => {
            return Modules.Messaging.search.globalSearchForRooms(ctx, args.query || '', { first: args.first, after: args.after || undefined, page: args.page || undefined, sort: args.sort || undefined });
        }),
        betaRoomInviteInfo: withAny(async (ctx, args) => {
            return await Modules.Invites.resolveInvite(ctx, args.invite);
        }),
        betaRoomInviteLink: withActivatedUser(async (ctx, args, uid) => {
            return await Modules.Invites.createRoomlInviteLink(ctx, IDs.Conversation.parse(args.roomId), uid);
        }),
        betaAvailableRooms: withActivatedUser(async (ctx, args, uid) => {
            return await Modules.Messaging.room.findAvailableRooms(ctx, uid);
        }),
        betaUserRooms: withActivatedUser(async (ctx, args, uid) => {
            return await Modules.Messaging.room.userRooms(ctx, uid, args.limit || undefined, args.after ? IDs.Conversation.parse(args.after) : undefined);
        }),
        betaUserAvailableRooms: withActivatedUser(async (ctx, args, uid) => {
            return await Modules.Messaging.room.userAvailableRooms(ctx, uid, args.isChannel === null ? undefined : args.isChannel, args.limit || undefined, args.after ? IDs.Conversation.parse(args.after) : undefined);
        }),
    },
    Mutation: {
        //
        // Room mgmt
        //
        betaRoomCreate: withAccount(async (parent, args, uid, oid) => {
            return inTx(parent, async (ctx) => {
                oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
                await validate({
                    title: optional(stringNotEmpty('Title can\'t be empty')),
                    kind: defined(enumString(['PUBLIC', 'GROUP'], 'kind expected to be PUBLIC or GROUP'))
                }, args);
                let imageRef = Sanitizer.sanitizeImageRef(args.photoRef);
                if (imageRef) {
                    await Modules.Media.saveFile(ctx, imageRef.uuid);
                }
                let room = await Modules.Messaging.room.createRoom(ctx, (args.kind).toLowerCase() as 'group' | 'public', oid, uid, args.members.map((v) => IDs.User.parse(v)), {
                    title: args.title!,
                    description: args.description,
                    image: imageRef,
                }, args.message || '', args.listed || undefined, args.channel || undefined, args.paid || undefined);

                return room;
            });
        }),
        betaRoomUpdate: withUser(async (parent, args, uid) => {
            return inTx(parent, async (ctx) => {
                await validate(
                    {
                        title: optional(stringNotEmpty('Title can\'t be empty!'))
                    },
                    args.input
                );

                let imageRef = Sanitizer.sanitizeImageRef(args.input.photoRef);
                if (args.input.photoRef) {
                    await Modules.Media.saveFile(ctx, args.input.photoRef.uuid);
                }

                let socialImageRef = Sanitizer.sanitizeImageRef(args.input.socialImageRef);
                if (args.input.socialImageRef) {
                    await Modules.Media.saveFile(ctx, args.input.socialImageRef.uuid);
                }

                let kind: 'internal' | 'public' | 'group' | undefined;

                if (args.input.kind) {
                    if (args.input.kind === 'INTERNAL') {
                        kind = 'internal';
                    } else if (args.input.kind === 'PUBLIC') {
                        kind = 'public';
                    } else if (args.input.kind === 'GROUP') {
                        kind = 'group';
                    }
                }

                return await Modules.Messaging.room.updateRoomProfile(ctx, IDs.Conversation.parse(args.roomId), uid, {
                    title: args.input.title!,
                    description: args.input.description === undefined ? undefined : Sanitizer.sanitizeString(args.input.description),
                    image: args.input.photoRef === undefined ? undefined : imageRef,
                    socialImage: args.input.socialImageRef === undefined ? undefined : socialImageRef,
                    kind: kind
                });
            });
        }),
        betaRoomMove: withUser(async (ctx, args, uid) => {
            return await Modules.Messaging.room.moveRoom(ctx, IDs.Conversation.parse(args.roomId), uid, IDs.Organization.parse(args.toOrg));
        }),

        //
        // Members mgmt
        //
        betaRoomInvite: withUser(async (ctx, args, uid) => {
            await validate({
                invites: mustBeArray({
                    userId: defined(stringNotEmpty()),
                })
            }, args);

            let members = args.invites.map((v) => IDs.User.parse(v.userId));

            return await Modules.Messaging.room.inviteToRoom(ctx, IDs.Conversation.parse(args.roomId), uid, members);
        }),
        alphaRoomInvite: withUser(async (ctx, args, uid) => {
            await validate({
                invites: mustBeArray({
                    userId: defined(stringNotEmpty()),
                })
            }, args);

            const cid = IDs.Conversation.parse(args.roomId);
            const members = args.invites.map((v) => IDs.User.parse(v.userId));

            await Modules.Messaging.room.inviteToRoom(ctx, cid, uid, members);

            const res = [];

            for (let member of members) {
                const addedMember = await Store.RoomParticipant.findById(ctx, cid, member);

                if (addedMember && addedMember.status === 'joined') {
                    res.push(addedMember);
                }
            }

            return res;
        }),
        betaRoomKick: withUser(async (parent, args, uid) => {
            let userId = IDs.User.parse(args.userId);
            return inTx(parent, async (ctx) => {
                if (uid === userId) {
                    return await Modules.Messaging.room.leaveRoom(ctx, IDs.Conversation.parse(args.roomId), uid);
                } else {
                    return await Modules.Messaging.room.kickFromRoom(ctx, IDs.Conversation.parse(args.roomId), uid, userId);
                }
            });
        }),
        betaRoomDeclineJoinRequest: withUser(async (parent, args, uid) => {
            let userId = IDs.User.parse(args.userId);
            return inTx(parent, async (ctx) => {
                return await Modules.Messaging.room.declineJoinRoomRequest(ctx, IDs.Conversation.parse(args.roomId), uid, userId);

            });
        }),
        betaRoomLeave: withUser(async (parent, args, uid) => {
            return await Modules.Messaging.room.leaveRoom(parent, IDs.Conversation.parse(args.roomId), uid);

        }),
        betaRoomChangeRole: withUser(async (ctx, args, uid) => {
            return await Modules.Messaging.room.updateMemberRole(ctx, IDs.Conversation.parse(args.roomId), uid, IDs.User.parse(args.userId), args.newRole.toLocaleLowerCase() as any);
        }),

        betaRoomJoin: withUser(async (ctx, args, uid) => {
            return await Modules.Messaging.room.joinRoom(ctx, IDs.Conversation.parse(args.roomId), uid, true);
        }),
        betaRoomsJoin: withUser(async (parent, args, uid) => {
            return inTx(parent, async (ctx) => {
                let res = [];
                for (let id of args.roomsIds) {
                    res.push(await Modules.Messaging.room.joinRoom(ctx, IDs.Conversation.parse(id), uid, true));
                }
                if (res.length) {
                    await Modules.Hooks.onDiscoverCompleted(ctx, uid);
                }
                return res;
            });
        }),
        betaBuyPaidChatPass: withUser(async (parent, args, uid) => {
            return inTx(parent, async (ctx) => {
                await Modules.Messaging.room.buyPaidChatPass(ctx, IDs.Conversation.parse(args.chatId), uid, args.paymentMethodId, args.retryKey);
                return true;
            });
        }),
        // invite links
        betaRoomInviteLinkSendEmail: withUser(async (parent, args, uid) => {
            await validate({
                inviteRequests: [{ email: defined(emailValidator) }]
            }, args);

            await inTx(parent, async (ctx) => {
                for (let inviteRequest of args.inviteRequests) {
                    await Modules.Invites.createRoomInvite(
                        ctx,
                        IDs.Conversation.parse(args.roomId),
                        uid,
                        inviteRequest.email,
                        inviteRequest.emailText || undefined,
                        inviteRequest.firstName || undefined,
                        inviteRequest.lastName || undefined
                    );
                }
            });

            return 'ok';
        }),
        betaRoomInviteLinkRenew: withUser(async (ctx, args, uid) => {
            let channelId = IDs.Conversation.parse(args.roomId);
            return await Modules.Invites.refreshRoomInviteLink(ctx, channelId, uid);
        }),
        betaRoomInviteLinkJoin: withUser(async (ctx, args, uid) => {
            return await Store.Conversation.findById(ctx, await Modules.Invites.joinRoomInvite(ctx, uid, args.invite, (args.isNewUser !== null && args.isNewUser !== undefined) ? args.isNewUser : false));
        }),

        //
        // User setting
        //
        betaRoomUpdateUserNotificationSettings: withUser(async (parent, args, uid) => {
            return await inTx(parent, async (ctx) => {
                let cid = IDs.Conversation.parse(args.roomId);
                let settings = await Modules.Messaging.getRoomSettings(ctx, uid, cid);
                if (args.settings.mute !== undefined && args.settings.mute !== null) {
                    if (settings.mute !== args.settings.mute) {
                        settings.mute = args.settings.mute;
                        await Modules.Messaging.room.onDialogMuteChanged(ctx, uid, cid, args.settings.mute);
                        await Modules.Hooks.onDialogMuteChanged(ctx, uid, cid, args.settings.mute);
                    }
                }
                return settings;
            });
        }),

        //
        // Admin tools
        //
        betaRoomAlterFeatured: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Messaging.room.setFeatured(ctx, IDs.Conversation.parse(args.roomId), args.featured);
        }),

        betaRoomAlterListed: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Messaging.room.setListed(ctx, IDs.Conversation.parse(args.roomId), args.listed);
        }),

        updateWelcomeMessage: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.roomId);
            let welcomeMessageIsOn = args.welcomeMessageIsOn;
            let welcomeMessageSender = args.welcomeMessageSender ? IDs.User.parse(args.welcomeMessageSender) : null;
            let welcomeMessageText = args.welcomeMessageText;

            return await Modules.Messaging.room.updateWelcomeMessage(ctx, cid, uid, welcomeMessageIsOn, welcomeMessageSender, welcomeMessageText);
        }),
        betaRoomsInviteUser: withPermission('super-admin', async (ctx, args) => {
            let res = [];
            let uid = IDs.User.parse(args.userId);

            for (let id of args.roomIds) {
                res.push(await Modules.Messaging.room.inviteToRoom(ctx, IDs.Conversation.parse(id), ctx.auth.uid!, [uid]));
            }

            return res;
        }),
    }
} as GQLResolver;
