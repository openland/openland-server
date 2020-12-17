import { Context } from '@openland/context';
import {
    Conversation,
    RoomProfile,
    RoomParticipant
} from './../../openland-module-db/store';
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
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Sanitizer } from 'openland-utils/Sanitizer';
import {
    validate,
    defined,
    stringNotEmpty,
    enumString,
    optional,
    mustBeArray,
    emailValidator
} from 'openland-utils/NewInputValidator';
import { MaybePromise } from '../../openland-module-api/schema/SchemaUtils';
import { buildElasticQuery, QueryParser } from '../../openland-utils/QueryParser';
import { buildBaseImageUrl } from '../../openland-module-media/ImageRef';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import SharedRoomRoot = GQLRoots.SharedRoomRoot;
import RoomMemberRoleRoot = GQLRoots.RoomMemberRoleRoot;
import { isDefined } from '../../openland-utils/misc';

type RoomRoot = Conversation | number;

export function withConverationId<T, R>(handler: (ctx: Context, src: number, args: T, showPlaceholder: boolean) => MaybePromise<R>) {
    return async (src: SharedRoomRoot, args: T, ctx: Context) => {
        if (typeof src === 'number') {
            let showPlaceholder = ctx.auth!.uid ? await Modules.Messaging.room.userWasKickedFromRoom(ctx, ctx.auth!.uid!, src) : false;
            return handler(ctx, src, args, showPlaceholder);
        } else {
            let showPlaceholder = ctx.auth!.uid ? await Modules.Messaging.room.userWasKickedFromRoom(ctx, ctx.auth!.uid!, src.id) : false;
            return handler(ctx, src.id, args, showPlaceholder);
        }
    };
}

function withRoomProfile(handler: (ctx: Context, src: RoomProfile | null, showPlaceholder: boolean) => any) {
    return async (src: SharedRoomRoot, args: {}, ctx: Context) => {
        if (typeof src === 'number') {
            let showPlaceholder = ctx.auth!.uid ? await Modules.Messaging.room.userWasKickedFromRoom(ctx, ctx.auth!.uid!, src) : false;
            return handler(ctx, (await Store.RoomProfile.findById(ctx, src)), showPlaceholder);
        } else {
            let showPlaceholder = ctx.auth!.uid ? await Modules.Messaging.room.userWasKickedFromRoom(ctx, ctx.auth!.uid!, src.id) : false;
            return handler(ctx, (await Store.RoomProfile.findById(ctx, src.id)), showPlaceholder);
        }
    };
}

export const Resolver: GQLResolver = {
    Room: {
        __resolveType: async (src: Conversation | number, ctx: Context) => {
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
        user: async (root: RoomRoot, args: {}, parent: Context) => {
            // In some cases we can't get ConversationPrivate here because it's not available in previous transaction, so we create new one
            return await inTx(parent, async (ctx) => {
                let proom = (await Store.ConversationPrivate.findById(ctx, typeof root === 'number' ? root : root.id))!;
                if (proom.uid1 === parent.auth.uid!) {
                    return proom.uid2;
                } else if (proom.uid2 === parent.auth.uid!) {
                    return proom.uid1;
                } else {
                    let deletedUserId = Modules.Users.getDeletedUserId();
                    if (deletedUserId) {
                        return deletedUserId;
                    }
                    throw new AccessDeniedError();
                }
            });
        },
        settings: async (root: RoomRoot, args: {}, ctx: Context) => await Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!, (typeof root === 'number' ? root : root.id)),
        pinnedMessage: async (root, args, ctx) => {
            let proom = (await Store.ConversationPrivate.findById(ctx, typeof root === 'number' ? root : root.id))!;
            if (proom.pinnedMessage) {
                return await Store.Message.findById(ctx, proom.pinnedMessage);
            } else {
                return null;
            }
        },
        myBadge: (root: RoomRoot, args: {}, ctx: Context) => null,
    },
    SharedRoomMembershipStatus: {
        MEMBER: 'joined',
        REQUESTED: 'requested',
        LEFT: 'left',
        KICKED: 'kicked',
        NONE: 'none',
    },
    RoomCallsMode: {
        DISABLED: 'disabled',
        LINK: 'link',
        STANDARD: 'standard'
    },
    RoomCallSettings: {
        callLink: root => root.callLink,
        mode: root => root.mode
    },
    RoomServiceMessageSettings: {
        joinsMessageEnabled: root => root.joinsMessageEnabled,
        leavesMessageEnabled: root => root.leavesMessageEnabled
    },
    SharedRoom: {
        id: (src) => IDs.Conversation.serialize(typeof src === 'number' ? src : src.id),
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
        isPremium: withConverationId(async (ctx, id) => {
            let room = await Store.ConversationRoom.findById(ctx, id);
            return !!(room && room.isPremium);
        }),
        premiumPassIsActive: withAuthFallback(withConverationId(async (ctx, id) => {
            let pass = ctx.auth.uid && await Store.PremiumChatUserPass.findById(ctx, id, ctx.auth.uid);
            return !!(pass && pass.isActive);
        }), false),
        premiumSettings: withConverationId(async (ctx, id) => {
            let premiumChatSettings = await Store.PremiumChatSettings.findById(ctx, id);
            if (!premiumChatSettings) {
                return null;
            }
            let interval: 'MONTH' | 'WEEK' | undefined;
            if (premiumChatSettings.interval === 'month') {
                interval = 'MONTH';
            } else if (premiumChatSettings.interval === 'week') {
                interval = 'WEEK';
            } else if (premiumChatSettings.interval) {
                throw Error('Unknown subscription interval: ' + premiumChatSettings.interval);
            }
            return { id, price: premiumChatSettings.price, interval };
        }),
        premiumSubscription: withAuthFallback(withConverationId(async (ctx, id) => {
            let pass = ctx.auth.uid && await Store.PremiumChatUserPass.findById(ctx, id, ctx.auth.uid);
            if (!pass || !pass.sid) {
                return null;
            }
            return await Store.WalletSubscription.findById(ctx, pass.sid);
        }), null),
        canSendMessage: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? false : !!(await Modules.Messaging.room.checkCanSendMessage(ctx, id, ctx.auth.uid!))), false),
        title: withConverationId(async (ctx, id) => Modules.Messaging.room.resolveConversationTitle(ctx, id, ctx.auth.uid!)),
        photo: withConverationId(async (ctx, id) => Modules.Messaging.room.resolveConversationPhoto(ctx, id, ctx.auth.uid!)),
        socialImage: withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? null : Modules.Messaging.room.resolveConversationSocialImage(ctx, id)),
        organization: withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? null : Modules.Messaging.room.resolveConversationOrganization(ctx, id)),

        description: withRoomProfile((ctx, profile, showPlaceholder) => showPlaceholder ? null : (profile && profile.description)),
        welcomeMessage: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? null : await Modules.Messaging.room.resolveConversationWelcomeMessage(ctx, id)), null),

        stickerPack: withRoomProfile((ctx, profile) => profile?.giftStickerPackId),

        pinnedMessage: withAuthFallback(withRoomProfile((ctx, profile, showPlaceholder) => showPlaceholder ? null : (profile && profile.pinnedMessage && Store.Message.findById(ctx, profile.pinnedMessage))), null),
        canUnpinMessage: withAuthFallback(withRoomProfile(async (ctx, profile, showPlaceholder) => {
            if (showPlaceholder) {
                return false;
            }
            let isAdmin = await Modules.Messaging.room.userHaveAdminPermissionsInRoom(ctx, ctx.auth.uid!, profile!.id);
            return isAdmin || profile!.pinnedMessageOwner === ctx.auth.uid!;
        }), false),

        membership: withConverationId(async (ctx, id, args, showPlaceholder) => (showPlaceholder ? 'none' : (ctx.auth.uid ? await Modules.Messaging.room.resolveUserMembershipStatus(ctx, ctx.auth.uid, id) : 'none')) as any),
        role: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => {
            if (showPlaceholder) {
                return 'MEMBER';
            }
            // TODO: Remove this after web release
            let room = (await Store.ConversationRoom.findById(ctx, id))!;
            if (room.ownerId === ctx.auth.uid!) {
                return 'OWNER';
            }
            if (room.oid && (await Modules.Orgs.isUserAdmin(ctx, ctx.auth.uid!, room.oid))) {
                return 'ADMIN';
            }
            return (await Modules.Messaging.room.resolveUserRole(ctx, ctx.auth.uid!, id)).toUpperCase() as RoomMemberRoleRoot;
        }), 'MEMBER'),
        membersCount: withRoomProfile((ctx, profile, showPlaceholder) => showPlaceholder ? 0 : (profile && profile.activeMembersCount) || 0),
        onlineMembersCount: withConverationId(async (ctx, id, args, showPlaceholder) => {
            return 0;
            // if (showPlaceholder) {
            //     return 0;
            // }
            // let onlineCount = 0;
            // let members = (await Modules.Messaging.room.findConversationMembers(ctx, id));
            // let membersOnline = await Promise.all(members.map(m => Store.Online.findById(ctx, m)));
            // for (let online of membersOnline) {
            //     if (online && online.lastSeen > Date.now()) {
            //         onlineCount++;
            //     }
            // }
            // return onlineCount;
        }),
        previewMembers: withConverationId(async (ctx, id, args, showPlaceholder) => {
            if (showPlaceholder) {
                return [];
            }

            let members = (await Store.RoomParticipant.active.query(ctx, id, { limit: 50 })).items;
            let profiles = await Promise.all(members.map(m => Store.UserProfile.findById(ctx, m.uid)));

            let membersWithPhoto = profiles.filter(p => p!.picture);
            let res = [...membersWithPhoto.map(m => m!.id)];
            if (res.length < 5 && members.length > 5) {
                let membersWithoutPhoto = profiles.filter(p => !p!.picture);
                res.push(...membersWithoutPhoto.map(m => m!.id));
            }
            return res.slice(0, 5);
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
                return (await Store.RoomParticipant.active.query(ctx, id, {
                    after: afterMember.uid,
                    limit: args.first || 1000
                })).items;
            }

            return (await Store.RoomParticipant.active.query(ctx, id, { limit: args.first || 1000 })).items;
        }), []),
        requests: withAuthFallback(withConverationId(async (ctx, id) => ctx.auth.uid && (await Modules.Messaging.room.resolveRequests(ctx, ctx.auth.uid, id)) || []), []),
        settings: withAuthFallback(async (root, args, ctx) => await Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!, (typeof root === 'number' ? root : root.id)), {
            cid: 0,
            mute: true
        } as any),
        canEdit: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => showPlaceholder ? false : await Modules.Messaging.room.canEditRoom(ctx, id, ctx.auth.uid!)), false),
        archived: withAuthFallback(withConverationId(async (ctx, id, args) => {
            let conv = await Store.Conversation.findById(ctx, id);
            if (conv && conv.archived) {
                return true;
            } else {
                return false;
            }
        }), false),
        myBadge: () => null,
        featuredMembersCount: withAuthFallback(withConverationId(async (ctx, id, args, showPlaceholder) => (await Store.UserRoomBadge.chat.findAll(ctx, id)).length), 0),
        matchmaking: withAuthFallback(withConverationId(async (ctx, id) => await Modules.Matchmaking.getRoom(ctx, id, 'room')), null),
        owner: withAuthFallback(withConverationId(async (ctx, id) => {
            let room = await Store.ConversationRoom.findById(ctx, id);
            return room && room.ownerId;
        }), null),
        repliesEnabled: withConverationId(async (ctx, id) => {
            let room = await Store.RoomProfile.findById(ctx, id);
            return !room?.repliesDisabled;
        }),
        callSettings: withConverationId(async (ctx, id) => {
            let room = await Store.RoomProfile.findById(ctx, id);
            return {
                mode: room?.callsMode || 'standard',
                callLink: room?.callLink || null,
            };
        }),
        serviceMessageSettings: withConverationId(async (ctx, id) => {
            return {
                joinsMessageEnabled: await Modules.Messaging.room.shouldSendJoinMessage(ctx, id),
                leavesMessageEnabled: await Modules.Messaging.room.shouldSendLeaveMessage(ctx, id),
            };
        }),
        featured: withConverationId(async (ctx, id) => {
            let room = await Store.ConversationRoom.findById(ctx, id);
            return !!room?.featured;
        })
    },
    RoomMember: {
        user: async (src, args, ctx) => (await Store.User.findById(ctx, src.uid))!,
        role: async (src) => src.role.toUpperCase() as RoomMemberRoleRoot,
        membership: async (src, args, ctx) => src.status,
        invitedBy: async (src, args, ctx) => src.invitedBy,
        canKick: async (src, args, ctx) => await Modules.Messaging.room.canKickFromRoom(ctx, src.cid, ctx.auth.uid!, src.uid),
        badge: (src, args, ctx) => null,
    },

    RoomInvite: {
        id: src => src.id,
        room: async (src, args, ctx) => (await Store.Conversation.findById(ctx, src.channelId))!,
        invitedByUser: async (src, args, ctx) => (await Store.User.findById(ctx, src.creatorId))!
    },

    RoomUserNotificaionSettings: {
        id: src => IDs.ConversationSettings.serialize(src.cid),
        mute: src => src.mute
    },

    RoomSuper: {
        id: (root: RoomRoot) => IDs.ConversationSuper.serialize(typeof root === 'number' ? root : root.id),
        featured: withConverationId(async (ctx, id) => {
            let room = await Store.ConversationRoom.findById(ctx, id);
            return !!(room && room.featured);
        }),
        listed: withConverationId(async (ctx, id) => {
            let room = await Store.ConversationRoom.findById(ctx, id);
            return !!(room && room.listed);
        }),
        autosubscribeRooms: withConverationId(async (ctx, id) => {
            let room = await Store.ConversationRoom.findById(ctx, id);
            return room!.autosubscribeRooms || [];
        }),
        giftStickerPackId: withRoomProfile(async (ctx, profile) => {
            return profile?.giftStickerPackId;
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
    SharedRoomConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },
    Query: {
        room: withAccount(async (ctx, args, uid, oid) => {
            let id = IdsFactory.resolve(args.id);
            if (id.type === IDs.Conversation) {
                if (await Modules.Messaging.room.userWasKickedFromRoom(ctx, uid, id.id as number)) {
                    return id.id as number;
                } else if (!await Modules.Messaging.room.canUserSeeChat(ctx, uid, id.id as number)) {
                    return null;
                }
                return id.id as number;
            } else if (id.type === IDs.User) {
                return await Modules.Messaging.room.resolvePrivateChat(ctx, id.id as number, uid);
            } else if (id.type === IDs.Organization) {
                let member = await Store.OrganizationMember.findById(ctx, id.id as number, uid);
                if (!member || member.status !== 'joined') {
                    return null;
                }
                return await Modules.Messaging.room.resolveOrganizationChat(ctx, id.id as number);
            } else {
                return null;
            }
        }),
        rooms: withAccount(async (ctx, args, uid, oid) => {
            let res: RoomRoot[] = [];
            for (let idRaw of args.ids) {
                let id = IdsFactory.resolve(idRaw);
                if (id.type === IDs.Conversation) {
                    if (await Modules.Messaging.room.userWasKickedFromRoom(ctx, uid, id.id as number)) {
                        res.push(id.id as number);
                    } else {
                        await Modules.Messaging.room.checkCanUserSeeChat(ctx, uid, id.id as number);
                    }
                    res.push(id.id as number);
                } else if (id.type === IDs.User) {
                    res.push(await Modules.Messaging.room.resolvePrivateChat(ctx, id.id as number, uid));
                } else if (id.type === IDs.Organization) {
                    let member = await Store.OrganizationMember.findById(ctx, id.id as number, uid);
                    if (!member || member.status !== 'joined') {
                        throw new IDMailformedError('Invalid id');
                    }
                    res.push(await Modules.Messaging.room.resolveOrganizationChat(ctx, id.id as number));
                } else {
                    throw new IDMailformedError('Invalid id');
                }
            }
            return res;
        }),
        // method only for external augmentation (metatags)
        roomSocialImage: async (src, args, ctx) => {
            let cid = IDs.Conversation.parse(args.roomId);
            let room = await Store.ConversationRoom.findById(ctx, cid);
            if (!room) {
                return null;
            }
            let image = await Modules.SocialImageModule.getRoomSocialImage(ctx, cid);
            return image ? buildBaseImageUrl(image) : null;
        },
        roomSuper: withPermission('super-admin', async (ctx, args) => {
            return IDs.Conversation.parse(args.id);
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
                let org = (await Store.Organization.findById(ctx, convOrg!.oid))!;

                let members = await Store.OrganizationMember.organization.findAll(ctx, 'joined', convOrg!.oid);
                return members.map(m => ({
                    cid: roomId,
                    uid: m.uid,
                    role: 'member',
                    status: 'joined',
                    invitedBy: m.invitedBy || org.ownerId
                }));
            } else {
                let adminsIds = new Map<number, number>();
                let admins = (await Store.RoomParticipant.admins.findAll(ctx, roomId));

                admins.forEach((row, i) => {
                    adminsIds.set(row.uid, i);
                });

                let afterMember: RoomParticipant | null = null;
                if (args.after) {
                    afterMember = await Store.RoomParticipant.findById(ctx, roomId, IDs.User.parse(args.after));
                    let adminsOffset = adminsIds.get(IDs.User.parse(args.after));
                    if (adminsOffset === undefined) {
                        admins = []; // no need for admins since we already pass them
                    } else {
                        admins = admins.slice(adminsOffset + 1);
                    }
                }
                let response: RoomParticipant[] = [];
                if (afterMember) {
                    response = (await Store.RoomParticipant.active.query(ctx, roomId, {
                        after: afterMember.uid,
                        limit: args.first || 1000
                    })).items;
                } else {
                    response = (await Store.RoomParticipant.active.query(ctx, roomId, { limit: args.first || 1000 })).items;
                }
                response = response.filter((row) => {
                    return !adminsIds.has(row.uid);
                });

                let limit = args.first || 1000;
                if (admins.length < limit) {
                    return admins.concat(response.slice(0, limit - admins.length));
                } else {
                    return admins.slice(0, limit);
                }

                return response;

            }
        }),
        roomAdmins: withActivatedUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.roomId);
            await Modules.Messaging.room.checkCanUserSeeChat(ctx, uid, roomId);
            let isAdmin = await Modules.Messaging.room.userHaveAdminPermissionsInRoom(ctx, uid, roomId);
            if (!isAdmin) {
                throw new AccessDeniedError();
            }
            let conversation = await Store.Conversation.findById(ctx, roomId);
            if (!conversation) {
                throw new Error('Room not found');
            }
            let members = await Store.RoomParticipant.active.findAll(ctx, roomId);
            return members.filter(m => m.role === 'admin' || m.role === 'owner');
        }),
        roomFeaturedMembers: withActivatedUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.roomId);
            await Modules.Messaging.room.checkCanUserSeeChat(ctx, uid, roomId);
            let conversation = await Store.Conversation.findById(ctx, roomId);
            if (!conversation) {
                throw new Error('Room not found');
            }
            let badges = (await Store.UserRoomBadge.chat.query(ctx, roomId, { limit: args.first || 1000 })).items;
            return (await Promise.all(badges.map(b => Store.RoomParticipant.findById(ctx, b.cid, b.uid)))).filter(isDefined);
        }),

        betaRoomSearch: withActivatedUser(async (ctx, args, uid) => {
            return Modules.Messaging.search.globalSearchForRooms(ctx, args.query || '', {
                first: args.first,
                after: args.after || undefined,
                page: args.page || undefined,
                sort: args.sort || undefined
            });
        }),
        betaRoomInviteInfo: withAny(async (ctx, args) => {
            return await Modules.Invites.resolveInvite(ctx, args.invite);
        }),
        betaRoomInviteLink: withActivatedUser(async (ctx, args, uid) => {
            return await Modules.Invites.createRoomlInviteLink(ctx, IDs.Conversation.parse(args.roomId), uid);
        }),
        alphaUserAvailableRooms: withActivatedUser(async (ctx, args, uid) => {
            let clauses: any[] = [];

            if (args.query) {
                let parser = new QueryParser();
                parser.registerText('title', 'title');
                parser.registerBoolean('featured', 'featured');
                parser.registerText('createdAt', 'createdAt');
                parser.registerText('updatedAt', 'updatedAt');
                parser.registerText('membersCount', 'membersCount');
                parser.registerBoolean('isChannel', 'isChannel');

                let parsed = parser.parseQuery(args.query);
                let elasticQuery = buildElasticQuery(parsed);
                clauses.push(elasticQuery);
            }

            let userOrgs = await Modules.Orgs.findUserOrganizations(ctx, uid);
            let userDialogs = await Modules.Messaging.findUserDialogs(ctx, uid);

            // listed OR from user orgs
            clauses.push({
                bool: {
                    should: [
                        { term: { listed: true } },
                        { terms: { oid: userOrgs } }
                    ],
                    must_not: { terms: { cid: userDialogs.map(d => d.cid) } }
                }
            });

            let hits = await Modules.Search.elastic.client.search({
                index: 'room',
                type: 'room',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : 0,
                body: {
                    sort: [{ membersCount: 'desc' }],
                    query: { bool: { must: clauses } }
                }
            });

            let ids = hits.hits.hits.map((v) => parseInt(v._id, 10));
            let rooms = await Promise.all(ids.map((v) => Store.Conversation.findById(ctx, v)));
            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            }
            let total = (hits.hits.total as any).value;

            return {
                edges: rooms.map((p, i) => {
                    return {
                        node: p,
                        cursor: (i + 1 + offset).toString()
                    };
                }),
                pageInfo: {
                    hasNextPage: (total - (offset + 1)) >= args.first,
                    hasPreviousPage: false,

                    itemsCount: total,
                    pagesCount: Math.min(Math.floor(8000 / args.first), Math.ceil(total / args.first)),
                    currentPage: Math.floor(offset / args.first) + 1,
                    openEnded: true
                },
            };
        }),
    },
    Mutation: {
        //
        // Room mgmt
        //
        betaRoomCreate: withAccount(async (parent, args, uid) => {
            let oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : undefined;
            return inTx(parent, async (ctx) => {
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
                }, args.message || '', args.listed || undefined, args.channel || undefined, args.price || undefined, args.interval === 'MONTH' ? 'month' : args.interval === 'WEEK' ? 'week' : undefined);

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
                    kind: kind,
                    repliesEnabled: args.input.repliesEnabled,
                    callSettings: args.input.callSettings,
                    serviceMessageSettings: args.input.serviceMessageSettings,
                    giftStickerPackId: args.input.giftStickerPackId ? IDs.StickerPack.parse(args.input.giftStickerPackId) : undefined
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
                    await Modules.Messaging.room.leaveRoom(ctx, IDs.Conversation.parse(args.roomId), uid, false);
                } else {
                    await Modules.Messaging.room.kickFromRoom(ctx, IDs.Conversation.parse(args.roomId), uid, userId, false);
                }
                return (await Store.Conversation.findById(ctx, IDs.Conversation.parse(args.roomId)))!;
            });
        }),
        betaRoomDeclineJoinRequest: withUser(async (parent, args, uid) => {
            let userId = IDs.User.parse(args.userId);
            return inTx(parent, async (ctx) => {
                return await Modules.Messaging.room.declineJoinRoomRequest(ctx, IDs.Conversation.parse(args.roomId), uid, userId);

            });
        }),
        betaRoomLeave: withUser(async (parent, args, uid) => {
            return await Modules.Messaging.room.leaveRoom(parent, IDs.Conversation.parse(args.roomId), uid, false);

        }),
        betaRoomChangeRole: withUser(async (ctx, args, uid) => {
            return await Modules.Messaging.room.updateMemberRole(ctx, IDs.Conversation.parse(args.roomId), uid, IDs.User.parse(args.userId), args.newRole.toLocaleLowerCase() as any);
        }),

        betaRoomJoin: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.room.joinRoom(ctx, IDs.Conversation.parse(args.roomId), uid, false);
            return (await Store.Conversation.findById(ctx, IDs.Conversation.parse(args.roomId)))!;
        }),
        betaRoomsJoin: withUser(async (parent, args, uid) => {
            return inTx(parent, async (ctx) => {
                let res = [];
                for (let id of args.roomsIds) {
                    await Modules.Messaging.room.joinRoom(ctx, IDs.Conversation.parse(id), uid, false);
                    res.push((await Store.Conversation.findById(ctx, IDs.Conversation.parse(id)))!);
                }
                if (res.length) {
                    await Modules.Hooks.onDiscoverCompleted(ctx, uid);
                }
                return res;
            });
        }),
        betaBuyPremiumChatSubscription: withUser(async (parent, args, uid) => {
            return inTx(parent, async (ctx) => {
                let cid = IDs.Conversation.parse(args.chatId);
                await Modules.Messaging.premiumChat.createPremiumChatSubscription(ctx, cid, uid);
                return cid;
            });
        }),
        betaBuyPremiumChatPass: withUser(async (parent, args, uid) => {
            return inTx(parent, async (ctx) => {
                let cid = IDs.Conversation.parse(args.chatId);
                await Modules.Messaging.premiumChat.buyPremiumChatPass(ctx, cid, uid);
                return cid;
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
            return (await Store.Conversation.findById(ctx, await Modules.Invites.joinRoomInvite(ctx, uid, args.invite, (args.isNewUser !== null && args.isNewUser !== undefined) ? args.isNewUser : false)))!;
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
                        await Modules.Messaging.setChatMuted(ctx, uid, cid, args.settings.mute);
                        await Modules.Messaging.messaging.counters.updateMuted(ctx, { cid, uid, muted: args.settings.mute });
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
            return await Modules.Messaging.room.setFeatured(ctx, IDs.ConversationSuper.parse(args.roomId), args.featured);
        }),

        betaRoomAlterListed: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Messaging.room.setListed(ctx, IDs.ConversationSuper.parse(args.roomId), args.listed);
        }),
        betaRoomSetupAutosubscribe: withPermission('super-admin', async (ctx, args) => {
            return await Modules.Messaging.room.setupAutosubscribe(ctx, IDs.ConversationSuper.parse(args.roomId), args.childRoomIds.map(a => IDs.Conversation.parse(a)));
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
};
