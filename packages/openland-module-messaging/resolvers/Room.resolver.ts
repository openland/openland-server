import { withAccount, withUser, withPermission } from 'openland-module-api/Resolvers';
import { IdsFactory, IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { IDMailformedError } from 'openland-errors/IDMailformedError';
import { FDB } from 'openland-module-db/FDB';
import { Conversation, RoomProfile, Message, RoomParticipant } from 'openland-module-db/schema';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { GQLResolver, GQL } from '../../openland-module-api/schema/SchemaSpec';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { validate, defined, stringNotEmpty, enumString, optional, mustBeArray } from 'openland-utils/NewInputValidator';
import { inTx } from 'foundation-orm/inTx';
import { AppContext } from 'openland-modules/AppContext';

type RoomRoot = Conversation | number;

function withConverationId(handler: (ctx: AppContext, src: number) => any) {
    return async (src: RoomRoot, args: {}, ctx: AppContext) => {
        if (typeof src === 'number') {
            return handler(ctx, src);
        } else {
            return handler(ctx, src.id);
        }
    };
}

function withRoomProfile(handler: (ctx: AppContext, src: RoomProfile) => any) {
    return async (src: RoomRoot, args: {}, ctx: AppContext) => {
        if (typeof src === 'number') {
            return handler(ctx, (await FDB.RoomProfile.findById(ctx, src))!);
        } else {
            return handler(ctx, (await FDB.RoomProfile.findById(ctx, src.id))!);
        }
    };
}

export default {
    Room: {
        __resolveType: async (src: Conversation | number, args: {}, ctx: AppContext) => {
            let conv: Conversation;
            if (typeof src === 'number') {
                conv = (await FDB.Conversation.findById(ctx, src))!;
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
        id: (root: RoomRoot) => IDs.Room.serialize(typeof root === 'number' ? root : root.id),
        user: async (root: RoomRoot, args: {}, ctx: AppContext) => {
            let proom = (await FDB.ConversationPrivate.findById(ctx, typeof root === 'number' ? root : root.id))!;
            if (proom.uid1 === ctx.auth.uid!) {
                return proom.uid2;
            } else if (proom.uid2 === ctx.auth.uid!) {
                return proom.uid1;
            } else {
                throw new AccessDeniedError();
            }
        }
    },
    SharedRoom: {
        id: (root: RoomRoot) => IDs.Room.serialize(typeof root === 'number' ? root : root.id),
        kind: withConverationId(async (ctx, id) => {
            let room = (await FDB.ConversationRoom.findById(ctx, id))!;
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
        title: withConverationId(async (ctx, id) => Modules.Messaging.room.resolveConversationTitle(ctx, id, ctx.auth.uid!)),
        listed: withConverationId(async (ctx, id) => !!(await FDB.ConversationRoom.findById(ctx, id))!.listed),
        featured: withConverationId(async (ctx, id) => !!(await FDB.ConversationRoom.findById(ctx, id))!.featured),
        photo: withConverationId(async (ctx, id) => Modules.Messaging.room.resolveConversationPhoto(ctx, id, ctx.auth.uid!)),
        organization: async (root: RoomRoot) => {
            throw new Error('Not implemented');
        },

        description: withRoomProfile((ctx, profile) => {
            return profile.description;
        }),

        membership: async (root: RoomRoot) => {
            throw new Error('Not implemented');
        },
        membersCount: async (root: RoomRoot, args: {}, ctx: AppContext) => (await FDB.RoomParticipant.allFromActive(ctx, (typeof root === 'number' ? root : root.id))).length,
        members: async (root: RoomRoot, args: {}, ctx: AppContext) => await FDB.RoomParticipant.allFromActive(ctx, (typeof root === 'number' ? root : root.id)),
    },
    RoomMessage: {
        id: (src: Message) => {
            return IDs.ConversationMessage.serialize(src.id);
        },
        message: (src: Message) => src.text || '',
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
        sender: (src: Message, _: any, ctx: AppContext) => FDB.User.findById(ctx, src.uid),
        date: (src: Message) => src.createdAt,
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
                let messages = await Promise.all((src.replyMessages as number[]).map(id => FDB.Message.findById(ctx, id)));
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
        mentions: async (src: Message, args: {}, ctx: AppContext) => src.mentions ? (src.mentions as number[]).map(id => FDB.User.findById(ctx, id)) : null
    },
    RoomMember: {
        user: async (src: RoomParticipant, args: {}, ctx: AppContext) => await FDB.User.findById(ctx, src.uid),
        role: async (src: RoomParticipant) => src.role === 'owner' ? 'CREATOR' : src.role === 'admin' ? 'ADMIN' : 'member',
    },

    Query: {
        room: withAccount<{ id: string }>(async (ctx, args, uid, oid) => {
            let id = IdsFactory.resolve(args.id);
            if (id.type === IDs.Room) {
                return id.id;
            } else if (id.type === IDs.User) {
                return Modules.Messaging.room.resolvePrivateChat(ctx, id.id, uid);
            } else if (id.type === IDs.Organization) {
                let member = await FDB.OrganizationMember.findById(ctx, id.id, uid);
                if (!member || member.status !== 'joined') {
                    throw new IDMailformedError('Invalid id');
                }
                return Modules.Messaging.room.resolveOrganizationChat(ctx, id.id);
            } else {
                throw new IDMailformedError('Invalid id');
            }
        }),
        roomMessages: withUser<GQL.QueryRoomMessagesArgs>(async (ctx, args, uid) => {
            let roomId = IDs.Room.parse(args.roomId);

            await Modules.Messaging.room.checkAccess(ctx, uid, roomId);

            let beforeMessage: Message | null = null;
            if (args.before) {
                beforeMessage = await FDB.Message.findById(ctx, IDs.ConversationMessage.parse(args.before));
            }

            if (beforeMessage) {
                await FDB.Message.rangeFromChatAfter(ctx, roomId, beforeMessage.id, args.first!, true);
            }

            return await FDB.Message.rangeFromChat(ctx, roomId, args.first!, true);
        }),
        roomMembers: withUser<GQL.QueryRoomMembersArgs>(async (ctx, args, uid) => {
            let roomId = IDs.Room.parse(args.roomId);
            let res = await FDB.RoomParticipant.allFromActive(ctx, roomId);
            return res;
        }),
    },
    Mutation: {
        //
        // Room mgmt
        //
        betaRoomCreate: withAccount<GQL.MutationBetaRoomCreateArgs>(async (ctx, args, uid, oid) => {
            await validate({
                title: optional(stringNotEmpty('Title can\'t be empty')),
                kind: defined(enumString(['PUBLIC', 'GROUP'], 'kind expected to be PUBLIC or GROUP'))
            }, args);
            let imageRef = Sanitizer.sanitizeImageRef(args.photoRef);
            if (imageRef) {
                await Modules.Media.saveFile(imageRef.uuid);
            }
            return Modules.Messaging.room.createRoom(ctx, (args.kind).toLowerCase() as 'group' | 'public', oid, uid, args.members.map((v) => IDs.User.parse(v)), {
                title: args.title!,
                image: imageRef
            }, args.message || '');
        }),
        betaRoomUpdate: withUser<GQL.MutationBetaRoomUpdateArgs>(async (ctx, args, uid) => {
            await validate(
                {
                    title: optional(stringNotEmpty('Title can\'t be empty!'))
                },
                args.input
            );

            let imageRef = Sanitizer.sanitizeImageRef(args.input.photoRef);
            if (args.input.photoRef) {
                await Modules.Media.saveFile(args.input.photoRef.uuid);
            }

            let socialImageRef = Sanitizer.sanitizeImageRef(args.input.socialImageRef);
            if (args.input.socialImageRef) {
                await Modules.Media.saveFile(args.input.socialImageRef.uuid);
            }

            let room = await Modules.Messaging.room.updateRoomProfile(ctx, IDs.Room.parse(args.roomId), uid, {
                title: args.input.title!,
                description: Sanitizer.sanitizeString(args.input.description),
                image: imageRef,
                socialImage: socialImageRef
            });

            return room;
        }),

        //
        // Members mgmt
        //
        betaRoomInvite: withUser<GQL.MutationBetaRoomInviteArgs>(async (ctx, args, uid) => {
            await validate({
                invites: mustBeArray({
                    userId: defined(stringNotEmpty()),
                })
            }, args);

            let members = args.invites.map((v) => IDs.User.parse(v.userId));

            return await Modules.Messaging.room.inviteToRoom(ctx, IDs.Room.parse(args.roomId), uid, members);
        }),
        betaRoomKick: withUser<GQL.MutationBetaRoomKickArgs>(async (ctx, args, uid) => {
            let userId = IDs.User.parse(args.userId);
            return inTx(async () => {
                if (uid === userId) {
                    return await Modules.Messaging.room.leaveRoom(ctx, IDs.Room.parse(args.roomId), uid);
                } else {
                    return await Modules.Messaging.room.kickFromRoom(ctx, IDs.Room.parse(args.roomId), uid, userId);
                }
            });
        }),
        betaRoomChangeRole: withUser<GQL.MutationBetaRoomChangeRoleArgs>(async (ctx, args, uid) => {
            let roleMap = {
                'CREATOR': 'owner',
                'ADMIN': 'admin',
                'MEMBER': 'member',
            };
            return await Modules.Messaging.room.updateMemberRole(ctx, IDs.Room.parse(args.roomId), uid, IDs.User.parse(args.userId), roleMap[args.newRole] as any);
        }),

        betaRoomJoin: withUser<GQL.MutationBetaRoomJoinArgs>(async (ctx, args, uid) => {
            return await Modules.Messaging.room.joinRoom(ctx, IDs.Room.parse(args.roomId), uid);
        }),

        //
        // User setting
        //
        betaRoomUpdateUserNotificationSettings: withUser<GQL.MutationBetaRoomUpdateUserNotificationSettingsArgs>(async (ctx, args, uid) => {
            return await inTx(async () => {
                let settings = await Modules.Messaging.getRoomSettings(ctx, uid, IDs.Room.parse(args.roomId));
                if (args.settings.mute !== undefined && args.settings.mute !== null) {
                    settings.mute = args.settings.mute;
                }
                return settings;
            });
        }),

        //
        // Admin tools
        //
        betaRoomAlterFeatured: withPermission<GQL.MutationBetaRoomAlterFeaturedArgs>('super-admin', async (ctx, args) => {
            return await Modules.Messaging.room.setFeatured(ctx, IDs.Room.parse(args.roomId), args.featured);
        }),

        betaRoomAlterListed: withPermission<GQL.MutationBetaRoomAlterListedArgs>('super-admin', async (ctx, args) => {
            return await Modules.Messaging.room.setListed(ctx, IDs.Room.parse(args.roomId), args.listed);
        }),

    }
} as GQLResolver;