import { Context } from '@openland/context';
import { IDs } from '../../openland-module-api/IDs';
import { withUser, resolveUser } from '../../openland-module-api/Resolvers';
import { URLAugmentation } from '../workers/UrlInfoService';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { createLogger } from '@openland/log';
import { User, Organization, Conversation } from 'openland-module-db/store';
import { isDefined } from '../../openland-utils/misc';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import MessageTypeRoot = GQLRoots.MessageTypeRoot;

const logger = createLogger('chat');

export const Resolver: GQLResolver = {
    Conversation: {
        __resolveType: async (src: Conversation, ctx: Context) => {
            if (src.kind === 'private') {
                return 'PrivateConversation';
            } else if (src.kind === 'organization') {
                return 'SharedConversation';
            } else {
                let room = (await Store.ConversationRoom.findById(ctx, src.id!));
                if (!room) {
                    logger.warn(ctx, 'Unable to find room: ' + src.id);
                }
                let kind = room!.kind;
                if (kind === 'group') {
                    return 'GroupConversation';
                } else {
                    return 'ChannelConversation';
                }
            }
        },
    },
    SharedConversation: {
        id: src => IDs.Conversation.serialize(src.id),
        flexibleId: async (src, _, ctx) => {
            return IDs.Conversation.serialize((await Store.ConversationOrganization.findById(ctx, src.id))!.oid);
        },
        title: async (src, _, ctx) => {
            return (await Store.OrganizationProfile.findById(ctx, (await Store.ConversationOrganization.findById(ctx, src.id))!.oid))!.name;
        },
        photos: async (src, _, ctx) => {
            let p = (await Store.OrganizationProfile.findById(ctx, (await Store.ConversationOrganization.findById(ctx, src.id))!.oid))!.photo;
            if (p) {
                return [buildBaseImageUrl(p)];
            } else {
                return [];
            }
        },
        unreadCount: async (src, _, ctx) => {
            return Store.UserDialogCounter.byId(ctx.auth.uid!, src.id).get(ctx);
        },
        topMessage: (src, _, ctx) => Modules.Messaging.findTopMessage(ctx, src.id!, ctx.auth.uid!),
        organization: async (src, _, ctx) => {
            return (await Store.Organization.findById(ctx, (await Store.ConversationOrganization.findById(ctx, src.id))!.oid))!;
        },
        settings: (src, _, ctx) => Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!!, src.id),
        organizations: () => []
    },
    PrivateConversation: {
        id: src => IDs.Conversation.serialize(src.id),
        flexibleId: async (src, _, ctx) => {
            let conv = (await Store.ConversationPrivate.findById(ctx, src.id))!;
            if (!conv) {
                logger.warn(ctx, 'Unable to find private conversation: ' + src.id);
            }
            if (conv.uid1 === ctx.auth.uid) {
                return IDs.User.serialize(conv.uid2);
            } else if (conv.uid2 === ctx.auth.uid) {
                return IDs.User.serialize(conv.uid1);
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
        },
        title: async (src, _, ctx) => {
            let uid;
            let conv = (await Store.ConversationPrivate.findById(ctx, src.id))!;
            if (conv.uid1 === ctx.auth.uid) {
                uid = conv.uid2;
            } else if (conv.uid2 === ctx.auth.uid) {
                uid = conv.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await Modules.Users.profileById(ctx, uid))!;
            return [profile.firstName, profile.lastName].filter((v) => !!v).join(' ');
        },
        photos: async (src, _, ctx) => {
            let uid;
            let conv = (await Store.ConversationPrivate.findById(ctx, src.id))!;
            if (conv.uid1 === ctx.auth.uid) {
                uid = conv.uid2;
            } else if (conv.uid2 === ctx.auth.uid) {
                uid = conv.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await Modules.Users.profileById(ctx, uid))!;

            if (profile.picture) {
                return [buildBaseImageUrl(profile.picture)];
            } else {
                return [];
            }
        },
        unreadCount: async (src, _, ctx) => {
            return Store.UserDialogCounter.byId(ctx.auth.uid!, src.id).get(ctx);
        },
        topMessage: (src, _, ctx) => Modules.Messaging.findTopMessage(ctx, src.id!, ctx.auth.uid!),
        user: async (src, _, ctx) => {
            let uid;
            let conv = (await Store.ConversationPrivate.findById(ctx, src.id))!;
            if (conv.uid1 === ctx.auth.uid) {
                uid = conv.uid2;
            } else if (conv.uid2 === ctx.auth.uid) {
                uid = conv.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            return (await Store.User.findById(ctx, uid))!;
        },
        blocked: async (src, _: any, ctx) => false,
        settings: (src, _: any, ctx) => Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!!, src.id),
    },
    GroupConversation: {
        id: src => IDs.Conversation.serialize(src.id),
        flexibleId: src => IDs.Conversation.serialize(src.id),
        title: async (src, _, ctx) => {
            let conv = (await Store.RoomProfile.findById(ctx, src.id))!;
            if (!conv) {
                logger.warn(ctx, 'Unable to find room for id: ' + src.id);
            }
            if (conv.title !== '') {
                return conv.title;
            }
            let res = (await Store.RoomParticipant.active.findAll(ctx, src.id)).filter((v) => v.uid !== ctx.auth.uid);
            let name: string[] = [];
            for (let r of res) {
                let p = (await Modules.Users.profileById(ctx, r.uid))!;
                name.push([p.firstName, p.lastName].filter((v) => !!v).join(' '));
            }
            return name.join(', ');
        },
        photos: async (src, _, ctx) => {
            // let res = await DB.ConversationGroupMembers.findAll({
            //     where: {
            //         conversationId: src.id,
            //         userId: {
            //             $not: context.uid
            //         }
            //     },
            //     order: ['userId']
            // });
            // let photos: string[] = [];
            // for (let r of res) {
            //     let p = (await DB.UserProfile.find({ where: { userId: r.userId } }))!!.picture;
            //     if (p) {
            //         photos.push(buildBaseImageUrl(p));
            //     }
            //     if (photos.length >= 4) {
            //         break;
            //     }
            // }
            // return photos;
            return [];
        },
        members: async (src, _, ctx) => {
            let res = await Store.RoomParticipant.active.findAll(ctx, src.id);
            return (await Promise.all(res.map((v) => Store.User.findById(ctx, v.uid)))).filter(isDefined);
        },
        unreadCount: async (src, _, ctx) => {
            return Store.UserDialogCounter.byId(ctx.auth.uid!, src.id).get(ctx);
        },
        topMessage: async (src, _, ctx) => {
            if (!await Modules.Messaging.room.isRoomMember(ctx, ctx.auth.uid!, src.id)) {
                return null;
            }

            return Modules.Messaging.findTopMessage(ctx, src.id!, ctx.auth.uid!);
        },
        membersCount: async (src, _, ctx) => Modules.Messaging.roomMembersCount(ctx, src.id),
        settings: async (src, _, ctx) => Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!, src.id),

        photo: async (src, _, ctx) => buildBaseImageUrl((await Store.RoomProfile.findById(ctx, src.id))!.image),
        photoRef: async (src, _, ctx) => (await Store.RoomProfile.findById(ctx, src.id))!.image,
        description: async (src, _, ctx) => (await Store.RoomProfile.findById(ctx, src.id))!.description as string,
        longDescription: src => '',
        pinnedMessage: src => null,
        membersOnline: async (src, _, ctx) => {
            return Modules.Presence.groups.getOnline(src.id);
        },
        myRole: async (src, _, ctx) => {
            let member = await Modules.Messaging.room.findMembershipStatus(ctx, ctx.auth.uid!, src.id);

            return member && member.role;
        },
    },

    MessageReaction: {
        user: async (src, args, ctx) => (await Store.User.findById(ctx, src.userId))!,
        reaction: (src: any) => src.reaction
    },
    UrlAugmentationExtra: {
        __resolveType(src: any) {
            if (src instanceof User) {
                return 'User';
            } else if (src instanceof Organization) {
                return 'Organization';
            } else if (src instanceof Conversation) {
                return 'ChannelConversation';
            }

            throw new Error('Unknown UrlAugmentationExtra');
        }
    },
    UrlAugmentation: {
        url: (src: URLAugmentation) => src.url,
        title: (src: URLAugmentation) => src.title,
        subtitle: (src: URLAugmentation) => src.subtitle,
        description: (src: URLAugmentation) => src.description,
        imageURL: (src: URLAugmentation) => buildBaseImageUrl(src.photo),
        imageInfo: (src: URLAugmentation) => src.imageInfo,
        photo: (src: URLAugmentation) => src.photo,
        iconRef: (src: URLAugmentation) => src.iconRef,
        iconInfo: (src: URLAugmentation) => src.iconInfo,
        hostname: (src: URLAugmentation) => src.hostname,
        type: (src: URLAugmentation) => 'url',
        extra: async (src: URLAugmentation, args: {}, ctx: Context) => null,
        date: () => ''
    },
    ConversationMessage: {
        id: src => {
            return IDs.ConversationMessage.serialize(src.id);
        },
        message: src => src.text,
        file: src => src.fileId as any,
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
        },
        filePreview: src => null,
        sender: async (src, _, ctx) => (await Store.User.findById(ctx, src.uid))!,
        date: src => src.metadata.createdAt,
        repeatKey: (src, args, ctx) => src.uid === ctx.auth.uid ? src.repeatKey : null,
        isService: src => src.isService,
        serviceMetadata: src => {
            if (src.serviceMetadata && (src.serviceMetadata as any).type) {
                return src.serviceMetadata;
            }

            return null;
        },
        urlAugmentation: src => src.augmentation || null,
        edited: src => (src.edited) || false,
        reactions: src => src.reactions || [],
        replyMessages: async (src, args, ctx) => {
            if (src.replyMessages) {
                let messages = await Promise.all((src.replyMessages as number[]).map(id => Store.Message.findById(ctx, id)));
                let filtered = messages.filter(isDefined);
                if (filtered.length > 0) {
                    return filtered;
                }
                return null;
            }
            return null;
            // return src.replyMessages ? (src.replyMessages as number[]).map(id => FDB.Message.findById(id)).filter(m => !!m) : [];
        },
        plainText: async src => null,
        mentions: async (src, arg, ctx) => {
            if (src.mentions) {
                return (await Promise.all((src.mentions as number[]).map(id => Store.User.findById(ctx, id)))).filter(isDefined);
            }
            return [];
        },
        alphaAttachments: async src => {
            let attachments: any[] = [];

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
        alphaButtons: async src => src.buttons ? src.buttons : [],
        alphaType: async src => src.type ? src.type as MessageTypeRoot : 'MESSAGE',
        postType: async src => src.postType,
        alphaTitle: async src => src.title,
        alphaMentions: async src => src.complexMentions
    },
    InviteServiceMetadata: {
        // users: (src: any, args: {}, ctx: Context) => src.userIds.map((id: number) => FDB.User.findById(ctx, id)),
        users: (src, args, ctx) => [],
        invitedBy: async (src, args, ctx) => (await Store.User.findById(ctx, src.invitedById))!
    },
    KickServiceMetadata: {
        user: resolveUser(),
        kickedBy: async (src, args, ctx) => (await Store.User.findById(ctx, src.kickedById))!
    },
    PostRespondServiceMetadata: {
        post: async (src, _, ctx) => (await Store.Message.findById(ctx, src.postId))!,
        postRoom: (src) => src.postRoomId,
        responder: (src) => src.responderId,
        respondType: (src) => src.respondType
    },
    ServiceMetadata: {
        __resolveType(src: any) {
            if (src.type === 'user_invite') {
                return 'InviteServiceMetadata';
            } else if (src.type === 'user_kick') {
                return 'KickServiceMetadata';
            } else if (src.type === 'title_change') {
                return 'TitleChangeServiceMetadata';
            } else if (src.type === 'photo_change') {
                return 'PhotoChangeServiceMetadata';
            } else if (src.type === 'post_respond') {
                return 'PostRespondServiceMetadata';
            }

            throw new Error('Unknown type');
        }
    },
    PhotoChangeServiceMetadata: {
        photo: (src: any) => src.picture ? buildBaseImageUrl(src.picture as any) : null,
        photoRef: (src: any) => src.picture,
    },

    NotificationCounter: {
        id: (src: number | { uid: number, counter: number }) => {
            if (typeof src === 'number') {
                return IDs.NotificationCounter.serialize(src);
            } else {
                return IDs.NotificationCounter.serialize(src.uid);
            }
        },
        unreadCount: async (src: number | { uid: number, counter: number }, args: {}, ctx: Context) => {
            if (typeof src === 'number') {
                return Modules.Messaging.counters.fetchUserGlobalCounter(ctx, src);
            } else {
                return src.counter;
            }
        }
    },

    ConversationSettings: {
        id: src => IDs.ConversationSettings.serialize(src.cid),
        mute: src => src.mute,
        mobileNotifications: src => 'all' as any
    },

    Query: {
        alphaNotificationCounter: withUser(async (ctx, args, uid) => uid),
    }
};
