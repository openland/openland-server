import { withAccount, withUser, withPermission } from 'openland-module-api/Resolvers';
import { IdsFactory, IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { IDMailformedError } from 'openland-errors/IDMailformedError';
import { FDB } from 'openland-module-db/FDB';
import { Conversation, RoomProfile, Message, RoomParticipant } from 'openland-module-db/schema';
import { CallContext } from 'openland-module-api/CallContext';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { GQLResolver, GQL } from '../../openland-module-api/schema/SchemaSpec';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { validate, defined, stringNotEmpty, enumString, optional, mustBeArray } from 'openland-utils/NewInputValidator';
import { inTx } from 'foundation-orm/inTx';

type RoomRoot = Conversation | number;

function withConverationId(handler: (src: number, context: CallContext) => any) {
    return async (src: RoomRoot, args: {}, context: CallContext) => {
        if (typeof src === 'number') {
            return handler(src, context);
        } else {
            return handler(src.id, context);
        }
    };
}

function withRoomProfile(handler: (src: RoomProfile) => any) {
    return async (src: RoomRoot) => {
        if (typeof src === 'number') {
            return handler((await FDB.RoomProfile.findById(src))!);
        } else {
            return handler((await FDB.RoomProfile.findById(src.id))!);
        }
    };
}

export default {
    Room: {
        __resolveType: async (src: Conversation | number) => {
            let conv: Conversation;
            if (typeof src === 'number') {
                conv = (await FDB.Conversation.findById(src))!;
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
        user: async (root: RoomRoot, args: {}, context: CallContext) => {
            let proom = (await FDB.ConversationPrivate.findById(typeof root === 'number' ? root : root.id))!;
            if (proom.uid1 === context.uid!) {
                return proom.uid2;
            } else if (proom.uid2 === context.uid!) {
                return proom.uid1;
            } else {
                throw new AccessDeniedError();
            }
        }
    },
    SharedRoom: {
        id: (root: RoomRoot) => IDs.Room.serialize(typeof root === 'number' ? root : root.id),
        kind: withConverationId(async (id) => {
            let room = (await FDB.ConversationRoom.findById(id))!;
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
        title: withConverationId(async (id, context) => Modules.Messaging.room.resolveConversationTitle(id, context.uid!)),
        listed: withConverationId(async (id, context) => !!(await FDB.ConversationRoom.findById(id))!.listed),
        featured: withConverationId(async (id, context) => !!(await FDB.ConversationRoom.findById(id))!.featured),
        photo: withConverationId(async (id, context) => Modules.Messaging.room.resolveConversationPhoto(id, context.uid!)),
        organization: async (root: RoomRoot) => {
            throw new Error('Not implemented');
        },

        description: withRoomProfile((profile) => {
            return profile.description;
        }),

        membership: async (root: RoomRoot) => {
            throw new Error('Not implemented');
        },
        membersCount: async (root: RoomRoot) => (await FDB.RoomParticipant.allFromActive((typeof root === 'number' ? root : root.id))).length,
        members: async (root: RoomRoot) => await FDB.RoomParticipant.allFromActive((typeof root === 'number' ? root : root.id)),
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
        sender: (src: Message, _: any, context: CallContext) => FDB.User.findById(src.uid),
        date: (src: Message) => src.createdAt,
        repeatKey: (src: Message, args: any, context: CallContext) => src.uid === context.uid ? src.repeatKey : null,
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
        replyMessages: async (src: Message) => {
            if (src.replyMessages) {
                let messages = await Promise.all((src.replyMessages as number[]).map(id => FDB.Message.findById(id)));
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
        mentions: async (src: Message) => src.mentions ? (src.mentions as number[]).map(id => FDB.User.findById(id)) : null
    },
    RoomMember: {
        user: async (src: RoomParticipant) => await FDB.User.findById(src.uid),
        role: async (src: RoomParticipant) => src.role === 'owner' ? 'CREATOR' : src.role === 'admin' ? 'ADMIN' : 'member',
    },

    Query: {
        room: withAccount<{ id: string }>(async (args, uid, oid) => {
            let id = IdsFactory.resolve(args.id);
            if (id.type === IDs.Room) {
                return id.id;
            } else if (id.type === IDs.User) {
                return Modules.Messaging.room.resolvePrivateChat(id.id, uid);
            } else if (id.type === IDs.Organization) {
                let member = await FDB.OrganizationMember.findById(id.id, uid);
                if (!member || member.status !== 'joined') {
                    throw new IDMailformedError('Invalid id');
                }
                return Modules.Messaging.room.resolveOrganizationChat(id.id);
            } else {
                throw new IDMailformedError('Invalid id');
            }
        }),
        roomMessages: withUser<GQL.QueryRoomMessagesArgs>(async (args, uid) => {
            let roomId = IDs.Room.parse(args.roomId);

            await Modules.Messaging.room.checkAccess(uid, roomId);

            let beforeMessage: Message | null = null;
            if (args.before) {
                beforeMessage = await FDB.Message.findById(IDs.ConversationMessage.parse(args.before));
            }

            if (beforeMessage) {
                await FDB.Message.rangeFromChatAfter(roomId, beforeMessage.id, args.first!, true);
            }

            return await FDB.Message.rangeFromChat(roomId, args.first!, true);
        }),
        roomMembers: withUser<GQL.QueryRoomMembersArgs>(async (args, uid) => {
            let roomId = IDs.Room.parse(args.roomId);
            let res = await FDB.RoomParticipant.allFromActive(roomId);
            return res;
        }),
    },
    Mutation: {
        //
        // Room mgmt
        //
        betaRoomCreate: withAccount<GQL.MutationBetaRoomCreateArgs>(async (args, uid, oid) => {
            await validate({
                title: optional(stringNotEmpty('Title can\'t be empty')),
                kind: defined(enumString(['PUBLIC', 'GROUP'], 'kind expected to be PUBLIC or GROUP'))
            }, args);
            let imageRef = Sanitizer.sanitizeImageRef(args.photoRef);
            if (imageRef) {
                await Modules.Media.saveFile(imageRef.uuid);
            }
            return Modules.Messaging.room.createRoom((args.kind).toLowerCase() as 'group' | 'public', oid, uid, args.members.map((v) => IDs.User.parse(v)), {
                title: args.title!,
                image: imageRef
            }, args.message || '');
        }),
        betaRoomUpdate: withUser<GQL.MutationBetaRoomUpdateArgs>(async (args, uid) => {
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

            let room = await Modules.Messaging.room.updateRoomProfile(IDs.Room.parse(args.roomId), uid, {
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
        betaRoomInvite: withUser<GQL.MutationBetaRoomInviteArgs>(async (args, uid) => {
            await validate({
                invites: mustBeArray({
                    userId: defined(stringNotEmpty()),
                })
            }, args);

            let members = args.invites.map((v) => IDs.User.parse(v.userId));

            return await Modules.Messaging.room.inviteToRoom(IDs.Room.parse(args.roomId), uid, members);
        }),
        betaRoomKick: withUser<GQL.MutationBetaRoomKickArgs>(async (args, uid) => {
            let userId = IDs.User.parse(args.userId);
            return inTx(async () => {
                if (uid === userId) {
                    return await Modules.Messaging.room.leaveRoom(IDs.Room.parse(args.roomId), uid);
                } else {
                    return await Modules.Messaging.room.kickFromRoom(IDs.Room.parse(args.roomId), uid, userId);
                }
            });
        }),
        betaRoomChangeRole: withUser<GQL.MutationBetaRoomChangeRoleArgs>(async (args, uid) => {
            let roleMap = {
                'CREATOR': 'owner',
                'ADMIN': 'admin',
                'MEMBER': 'member',
            };
            return await Modules.Messaging.room.updateMemberRole(IDs.Room.parse(args.roomId), uid, IDs.User.parse(args.userId), roleMap[args.newRole] as any);
        }),

        betaRoomJoin: withUser<GQL.MutationBetaRoomJoinArgs>(async (args, uid) => {
            return await Modules.Messaging.room.joinRoom(IDs.Room.parse(args.roomId), uid);
        }),

        //
        // User setting
        //
        betaRoomUpdateUserNotificationSettings: withUser<GQL.MutationBetaRoomUpdateUserNotificationSettingsArgs>(async (args, uid) => {
            return await inTx(async () => {
                let settings = await Modules.Messaging.getRoomSettings(uid, IDs.Room.parse(args.roomId));
                if (args.settings.mute !== undefined && args.settings.mute !== null) {
                    settings.mute = args.settings.mute;
                }
                return settings;
            });
        }),

        //
        // Admin tools
        //
        betaRoomAlterFeatured: withPermission<GQL.MutationBetaRoomAlterFeaturedArgs>('super-admin', async (args) => {
            return await Modules.Messaging.room.setFeatured(IDs.Room.parse(args.roomId), args.featured);
        }),

        betaRoomAlterListed: withPermission<GQL.MutationBetaRoomAlterListedArgs>('super-admin', async (args) => {
            return await Modules.Messaging.room.setListed(IDs.Room.parse(args.roomId), args.listed);
        }),

    }
} as GQLResolver;