import { withAccount, withUser, withPermission, withAny } from 'openland-module-api/Resolvers';
import { IdsFactory, IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { IDMailformedError } from 'openland-errors/IDMailformedError';
import { FDB } from 'openland-module-db/FDB';
import { Conversation, RoomProfile, Message, RoomParticipant, ChannelInvitation, ChannelLink, UserDialogSettings } from 'openland-module-db/schema';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { validate, defined, stringNotEmpty, enumString, optional, mustBeArray, emailValidator } from 'openland-utils/NewInputValidator';
import { inTx } from 'foundation-orm/inTx';
import { AppContext } from 'openland-modules/AppContext';
import { QueryParser } from 'openland-utils/QueryParser';

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

function withRoomProfile(handler: (ctx: AppContext, src: RoomProfile | null) => any) {
    return async (src: RoomRoot, args: {}, ctx: AppContext) => {
        if (typeof src === 'number') {
            return handler(ctx, (await FDB.RoomProfile.findById(ctx, src)));
        } else {
            return handler(ctx, (await FDB.RoomProfile.findById(ctx, src.id)));
        }
    };
}

export default {
    Room: {
        __resolveType: async (src: Conversation | number, ctx: AppContext) => {
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
        id: (root: RoomRoot) => IDs.Conversation.serialize(typeof root === 'number' ? root : root.id),
        user: async (root: RoomRoot, args: {}, ctx: AppContext) => {
            let proom = (await FDB.ConversationPrivate.findById(ctx, typeof root === 'number' ? root : root.id))!;
            if (proom.uid1 === ctx.auth.uid!) {
                return proom.uid2;
            } else if (proom.uid2 === ctx.auth.uid!) {
                return proom.uid1;
            } else {
                throw new AccessDeniedError();
            }
        },
        settings: async (root: RoomRoot, args: {}, ctx: AppContext) => await Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!, (typeof root === 'number' ? root : root.id))
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
            let room = (await FDB.ConversationRoom.findById(ctx, id))!;
            // temp fix resolve openland internal chat
            let conveOrg = (await FDB.ConversationOrganization.findById(ctx, id))!;
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
        title: withConverationId(async (ctx, id) => Modules.Messaging.room.resolveConversationTitle(ctx, id, ctx.auth.uid!)),
        photo: withConverationId(async (ctx, id) => Modules.Messaging.room.resolveConversationPhoto(ctx, id, ctx.auth.uid!)),
        socialImage: withConverationId(async (ctx, id) => Modules.Messaging.room.resolveConversationSocialImage(ctx, id)),
        organization: withConverationId(async (ctx, id) => Modules.Messaging.room.resolveConversationOrganization(ctx, id)),

        description: withRoomProfile((ctx, profile) => {
            return profile && profile.description;
        }),

        membership: withConverationId(async (ctx, id) => ctx.auth.uid ? await Modules.Messaging.room.resolveUserMembershipStatus(ctx, ctx.auth.uid, id) : 'none'),
        role: withConverationId(async (ctx, id) => (await Modules.Messaging.room.resolveUserRole(ctx, ctx.auth.uid!, id)).toUpperCase()),
        membersCount: async (root: RoomRoot, args: {}, ctx: AppContext) => (await FDB.RoomParticipant.allFromActive(ctx, (typeof root === 'number' ? root : root.id))).length,
        members: withConverationId(async (ctx, id) => await FDB.RoomParticipant.allFromActive(ctx, id)),
        settings: async (root: RoomRoot, args: {}, ctx: AppContext) => await Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!, (typeof root === 'number' ? root : root.id))
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
        role: async (src: RoomParticipant) => src.role.toUpperCase(),
        membership: async (src: RoomParticipant, args: {}, ctx: AppContext) => await Modules.Messaging.room.resolveUserMembershipStatus(ctx, src.uid, src.cid) as any,
    },

    RoomInvite: {
        room: (src: ChannelInvitation | ChannelLink, args: {}, ctx: AppContext) => FDB.Conversation.findById(ctx, src.channelId),
        invitedByUser: (src: ChannelInvitation | ChannelLink, args: {}, ctx: AppContext) => FDB.User.findById(ctx, src.creatorId)
    },

    RoomUserNotificaionSettings: {
        id: (src: UserDialogSettings) => IDs.ConversationSettings.serialize(src.cid),
        mute: (src: UserDialogSettings) => src.mute
    },

    Query: {
        room: withAccount(async (ctx, args, uid, oid) => {
            let id = IdsFactory.resolve(args.id);
            if (id.type === IDs.Conversation) {
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
        roomMessages: withUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.roomId);

            await Modules.Messaging.room.checkAccess(ctx, uid, roomId);

            let beforeMessage: Message | null = null;
            if (args.before) {
                beforeMessage = await FDB.Message.findById(ctx, IDs.ConversationMessage.parse(args.before));
            }

            if (beforeMessage) {
                return await FDB.Message.rangeFromChatAfter(ctx, roomId, beforeMessage.id, args.first!, true);
            }

            return await FDB.Message.rangeFromChat(ctx, roomId, args.first!, true);
        }),
        roomMembers: withUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.roomId);
            let res = await FDB.RoomParticipant.allFromActive(ctx, roomId);
            return res;
        }),

        betaRoomSearch: withUser(async (ctx, args, uid) => {
            let clauses: any[] = [];
            let sort: any[] | undefined = undefined;

            if (args.query || args.sort) {
                let parser = new QueryParser();
                parser.registerText('title', 'title');
                parser.registerBoolean('featured', 'featured');
                parser.registerText('createdAt', 'createdAt');
                parser.registerText('updatedAt', 'updatedAt');
                parser.registerText('membersCount', 'membersCount');

                if (args.query) {
                    clauses.push({ match_phrase_prefix: { title: args.query } });
                } else {
                    clauses.push({ term: { featured: true } });
                }

                if (args.sort) {
                    sort = parser.parseSort(args.sort);
                }
            }

            clauses.push({ term: { hidden: false } });

            let hits = await Modules.Search.elastic.client.search({
                index: 'channels',
                type: 'channel',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : (args.page ? ((args.page - 1) * args.first) : 0),
                body: {
                    sort: sort,
                    query: { bool: { must: clauses } }
                }
            });

            let ids = hits.hits.hits.map((v) => parseInt(v._id, 10));
            let rooms = await Promise.all(ids.map((v) => FDB.Conversation.findById(ctx, v)));
            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }
            let total = hits.hits.total;

            return {
                edges: rooms.map((p, i) => {
                    return {
                        node: p,
                        cursor: (i + 1 + offset).toString()
                    };
                }),
                pageInfo: {
                    hasNextPage: (total - (offset + 1)) >= args.first, // ids.length === this.limitValue,
                    hasPreviousPage: false,

                    itemsCount: total,
                    pagesCount: Math.min(Math.floor(8000 / args.first), Math.ceil(total / args.first)),
                    currentPage: Math.floor(offset / args.first) + 1,
                    openEnded: true
                },
            };
        }),
        betaRoomInviteInfo: withAny(async (ctx, args) => {
            return await Modules.Invites.resolveInvite(ctx, args.invite);
        }),
        betaRoomInviteLink: withUser(async (ctx, args, uid) => {
            return await Modules.Invites.createRoomlInviteLink(ctx, IDs.Conversation.parse(args.roomId), uid);
        })
    },
    Mutation: {
        //
        // Room mgmt
        //
        betaRoomCreate: withAccount(async (ctx, args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
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
                description: args.description,
                image: imageRef
            }, args.message || '', args.listed || undefined);
        }),
        betaRoomUpdate: withUser(async (ctx, args, uid) => {
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

            let room = await Modules.Messaging.room.updateRoomProfile(ctx, IDs.Conversation.parse(args.roomId), uid, {
                title: args.input.title!,
                description: Sanitizer.sanitizeString(args.input.description),
                image: args.input.photoRef === undefined ? undefined : imageRef,
                socialImage: args.input.socialImageRef === undefined ? undefined : socialImageRef
            });

            return room;
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
        betaRoomLeave: withUser(async (parent, args, uid) => {
            return await Modules.Messaging.room.leaveRoom(parent, IDs.Conversation.parse(args.roomId), uid);

        }),
        betaRoomChangeRole: withUser(async (ctx, args, uid) => {
            return await Modules.Messaging.room.updateMemberRole(ctx, IDs.Conversation.parse(args.roomId), uid, IDs.User.parse(args.userId), args.newRole.toLocaleLowerCase() as any);
        }),

        betaRoomJoin: withUser(async (ctx, args, uid) => {
            return await Modules.Messaging.room.joinRoom(ctx, IDs.Conversation.parse(args.roomId), uid, true);
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
            return await FDB.Conversation.findById(ctx, await Modules.Invites.joinRoomInvite(ctx, uid, args.invite));
        }),

        //
        // User setting
        //
        betaRoomUpdateUserNotificationSettings: withUser(async (parent, args, uid) => {
            return await inTx(parent, async (ctx) => {
                let settings = await Modules.Messaging.getRoomSettings(ctx, uid, IDs.Conversation.parse(args.roomId));
                if (args.settings.mute !== undefined && args.settings.mute !== null) {
                    settings.mute = args.settings.mute;
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

    }
} as GQLResolver;