import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { IDs, IdsFactory } from '../../openland-module-api/IDs';
import { withUser, resolveUser, withAccount } from '../../openland-module-api/Resolvers';
import {
    validate,
    stringNotEmpty,
    enumString,
    optional,
    defined,
    mustBeArray,
} from '../../openland-utils/NewInputValidator';
import { IDMailformedError } from '../../openland-errors/IDMailformedError';
import { UserError } from '../../openland-errors/UserError';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { Sanitizer } from '../../openland-utils/Sanitizer';
import { URLAugmentation } from '../workers/UrlInfoService';
import { Modules } from 'openland-modules/Modules';
import { Message } from 'openland-module-db/store';
import { Store } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { MessageAttachmentInput, MessageSpan } from '../MessageInput';
import { prepareLegacyMentionsInput } from './ModernMessage.resolver';
import { createLogger } from '@openland/log';
import { User, Organization, UserDialogSettings, Conversation } from 'openland-module-db/store';
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
            let members = await Modules.Messaging.room.findConversationMembers(ctx, src.id);
            let onlines = await Promise.all(members.map(m => Modules.Presence.getLastSeen(ctx, m)));
            return onlines.filter(s => s === 'online').length;
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
        // users: (src: any, args: {}, ctx: AppContext) => src.userIds.map((id: number) => FDB.User.findById(ctx, id)),
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
    ChatReadResult: {
        conversation: async (src: { uid: number, conversationId: number }, args: {}, ctx: Context) => (await Store.Conversation.findById(ctx, src.conversationId))!,
        counter: (src: { uid: number, conversationId: number }) => src.uid
    },
    ComposeSearchResult: {
        __resolveType(obj: User | Organization) {
            if (obj instanceof User) {
                return 'User';
            } else if (obj instanceof Organization) {
                return 'Organization';
            }
            throw Error('Unknown type');
        }
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
                return Modules.Messaging.fetchUserGlobalCounter(ctx, src);
            } else {
                return src.counter;
            }
        }
    },

    GroupConversationMember: {
        role: src => src.role === 'owner' ? 'creator' : src.role,
        user: async (src, args, ctx) => (await Store.User.findById(ctx, src.uid))!
    },

    ConversationSettings: {
        id: (src: UserDialogSettings) => IDs.ConversationSettings.serialize(src.cid),
        mute: (src: UserDialogSettings) => src.mute,
        mobileNotifications: (src: UserDialogSettings) => 'all' as any
    },

    Query: {
        alphaNotificationCounter: withUser(async (ctx, args, uid) => uid),
        alphaChat: withAccount(async (ctx, args, uid, oid) => {
            if (args.shortName) {
                let shortName = await Modules.Shortnames.findShortname(ctx, args.shortName);
                if (!shortName) {
                    throw new NotFoundError();
                }

                if (shortName.ownerType === 'user') {
                    return Modules.Messaging.room.resolvePrivateChat(ctx, shortName.ownerId!, uid);
                } // else if (shortName.ownerType === 'org') {
                // return Repos.Chats.loadOrganizationalChat(oid, shortName.ownerId!);
                // } else {
                throw new NotFoundError();
                // }
            } else if (args.conversationId) {
                let id = IdsFactory.resolve(args.conversationId);
                if (id.type === IDs.Conversation) {
                    return (await Store.Conversation.findById(ctx, id.id as number))!;
                } else if (id.type === IDs.User) {
                    return Modules.Messaging.room.resolvePrivateChat(ctx, id.id as number, uid);
                } else if (id.type === IDs.Organization) {
                    let member = await Store.OrganizationMember.findById(ctx, id.id as number, uid);
                    if (!member || member.status !== 'joined') {
                        throw new IDMailformedError('Invalid id');
                    }
                    return await Modules.Messaging.room.resolveOrganizationChat(ctx, id.id as number);
                } else {
                    throw new IDMailformedError('Invalid id');
                }
            } else {
                throw new UserError('No id passed');
            }
        }),
        alphaLoadMessages: withUser(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);

            await Modules.Messaging.room.checkAccess(ctx, uid, conversationId);

            let beforeMessage: Message | null = null;
            if (args.before) {
                beforeMessage = await Store.Message.findById(ctx, IDs.ConversationMessage.parse(args.before));
            }

            if (beforeMessage) {
                return {
                    seq: 0,
                    messages: (await Store.Message.chat.query(ctx, conversationId, { after: beforeMessage.id, limit: args.first!, reverse: true })).items
                };
            }

            return {
                seq: 0,
                messages: (await Store.Message.chat.query(ctx, conversationId, { limit: args.first!, reverse: true })).items
            };
        }),
        alphaChatsSearchForCompose: withAccount(async (ctx, args, uid, oid) => {

            // Do search
            let { uids } = await Modules.Users.searchForUsers(ctx, args.query || '', {
                uid,
                limit: args.limit || 10
            });

            if (uids.length === 0) {
                return [];
            }

            // Fetch profiles
            let users = (await Promise.all(uids.map((v) => Store.User.findById(ctx, v)))).filter((v) => v && v.status === 'activated');
            let restored: any[] = [];
            for (let u of uids) {
                let existing = users.find((v) => v!.id === u);
                if (existing) {
                    restored.push(existing);
                }
            }
            return restored;
        }),
        // keep it until web compose redesigned
        alphaChatSearch: withUser(async (ctx, args, uid) => {
            let members = [...args.members.map((v) => IDs.User.parse(v)), uid];
            let groups = await Store.RoomParticipant.active.findAll(ctx, uid);
            let suitableGroups: number[] = [];
            for (let f of groups) {
                let allMembers = await Store.RoomParticipant.active.findAll(ctx, f.cid);
                if (allMembers.length !== members.length) {
                    continue;
                }

                let missed = members
                    .map((v) => !!allMembers.find((v2) => v2.uid === v))
                    .filter((v) => !v);
                if (missed.length > 0) {
                    continue;
                }
                suitableGroups.push(f.cid);
            }
            if (suitableGroups.length === 0) {
                return null;
            }

            for (let cid of suitableGroups) {
                let res = await Store.Conversation.findById(ctx, cid);
                if (res) {
                    return res;
                }
            }
            return null;
        }),
        alphaGroupConversationMembers: withUser(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let res = await Store.RoomParticipant.active.findAll(ctx, conversationId);
            return res;
        }),
    },
    Mutation: {
        alphaReadChat: withUser(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            await Modules.Messaging.readRoom(ctx, uid, conversationId, messageId);
            return {
                uid: uid,
                conversationId: conversationId
            };
        }),
        // Deprecated
        alphaGlobalRead: withUser(async (ctx, args, uid) => {
            // await Modules.Messaging.markAsSeqRead(ctx, uid, args.toSeq);
            return 'ok';
        }),
        alphaSendMessage: withUser(async (parent, args, uid) => {
            let ctx = parent;
            let conversationId = IDs.Conversation.parse(args.conversationId);

            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));
            let mentions = args.mentions && args.mentions.map(id => IDs.User.parse(id));

            let attachments: MessageAttachmentInput[] = [];

            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(ctx, args.file);
                let filePreview: string | null = null;
                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(ctx, args.file);
                }
                attachments.push({
                    type: 'file_attachment',
                    fileId: args.file,
                    fileMetadata: fileInfo,
                    filePreview
                });
            }

            let spans: MessageSpan[] = [];

            if (mentions) {
                spans.push(...await prepareLegacyMentionsInput(ctx, args.message || '', mentions));
            }

            return Modules.Messaging.sendMessage(ctx, conversationId, uid!, {
                message: args.message,
                attachments,
                replyMessages,
                spans,
                repeatKey: args.repeatKey
            });
        }),
        alphaSendIntro: withUser(async (ctx, args, uid) => {
            throw new UserError('Deprecated API');
        }),
        alphaEditIntro: withUser(async (ctx, args, uid) => {
            throw new UserError('Deprecated API');
        }),
        alphaEditMessage: withUser(async (ctx, args, uid) => {
            throw new UserError('Deprecated API');
        }),
        alphaDeleteMessageUrlAugmentation: withUser(async (ctx, args, uid) => {
            let mid = IDs.ConversationMessage.parse(args.messageId);

            let message = await Store.Message.findById(ctx, mid);
            if (!message || message.deleted) {
                throw new NotFoundError();
            }

            let newAttachments: MessageAttachmentInput[] = [];

            if (message.attachmentsModern) {
                newAttachments = message.attachmentsModern.filter(a => a.type !== 'rich_attachment').map(a => {
                    delete a.id;
                    return a;
                });
            }

            return await Modules.Messaging.editMessage(ctx, IDs.ConversationMessage.parse(args.messageId), uid, {
                attachments: newAttachments,
                ignoreAugmentation: true,
            }, false);
        }),
        alphaDeleteMessage: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            return await Modules.Messaging.deleteMessage(ctx, messageId, uid);
        }),

        //
        // Group Management
        //

        alphaChatCreateGroup: withAccount(async (ctx, args, uid, oid) => {
            let title = args.title ? args.title!! : '';
            let imageRef = Sanitizer.sanitizeImageRef(args.photoRef);
            if (imageRef) {
                await Modules.Media.saveFile(ctx, imageRef.uuid);
            }
            return Modules.Messaging.room.createRoom(ctx, 'group', oid, uid, args.members.map((v) => IDs.User.parse(v)), {
                title: title,
                image: imageRef
            }, args.message || '');
        }),
        alphaChatUpdateGroup: withUser(async (ctx, args, uid) => {
            await validate(
                {
                    title: optional(stringNotEmpty('Title can\'t be empty!'))
                },
                args.input
            );

            let conversationId = IDs.Conversation.parse(args.conversationId);

            let imageRef = Sanitizer.sanitizeImageRef(args.input.photoRef);
            if (args.input.photoRef) {
                await Modules.Media.saveFile(ctx, args.input.photoRef.uuid);
            }

            let socialImageRef = Sanitizer.sanitizeImageRef(args.input.socialImageRef);
            if (args.input.socialImageRef) {
                await Modules.Media.saveFile(ctx, args.input.socialImageRef.uuid);
            }

            let conv = await Modules.Messaging.room.updateRoomProfile(ctx, conversationId, uid, {
                title: args.input.title!,
                description: args.input.description!,
                image: imageRef,
                socialImage: socialImageRef
            });

            return {
                chat: conv,
                curSeq: 0
            };
        }),
        alphaChatInviteToGroup: withUser(async (ctx, args, uid) => {
            await validate({
                invites: mustBeArray({
                    userId: defined(stringNotEmpty()),
                    role: defined(enumString(['member', 'admin']))
                })
            }, args);

            let conversationId = IDs.Conversation.parse(args.conversationId);

            let members = args.invites.map((v) => IDs.User.parse(v.userId));

            let chat = await Modules.Messaging.room.inviteToRoom(ctx, conversationId, uid, members);
            return {
                chat
            };
        }),
        alphaChatKickFromGroup: withUser(async (parent, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let userId = IDs.User.parse(args.userId);
            return inTx(parent, async (ctx) => {
                if (uid === userId) {
                    let chat = await Modules.Messaging.room.leaveRoom(ctx, conversationId, uid);
                    return {
                        chat
                    };
                } else {
                    let chat = await Modules.Messaging.room.kickFromRoom(ctx, conversationId, uid, userId);
                    return {
                        chat
                    };
                }
            });
        }),
        alphaChatChangeRoleInGroup: withUser(async (ctx, args, uid) => {
            await validate({
                newRole: defined(enumString(['member', 'admin']))
            }, args);

            let conversationId = IDs.Conversation.parse(args.conversationId);
            let userId = IDs.User.parse(args.userId);

            let conv = await Modules.Messaging.room.updateMemberRole(ctx, conversationId, uid, userId, args.newRole as any);

            return {
                chat: conv
            };
        }),

        alphaBlockUser: withUser(async (ctx, args, uid) => {
            return 'ok';
        }),
        alphaUnblockUser: withUser(async (ctx, args, uid) => {
            return 'ok';
        }),
        alphaUpdateConversationSettings: withUser(async (parent, args, uid) => {
            let cid = IDs.Conversation.parse(args.conversationId);
            return await inTx(parent, async (ctx) => {
                let settings = await Modules.Messaging.getRoomSettings(ctx, uid, cid);
                if (args.settings.mute !== undefined && args.settings.mute !== null) {
                    settings.mute = args.settings.mute;
                }
                return settings;
            });
        }),
        alphaChatLeave: withAccount(async (parent, args, uid) => {
            return inTx(parent, async (ctx) => {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                let res = await Modules.Messaging.room.leaveRoom(ctx, conversationId, uid);

                return {
                    chat: res
                };
            });
        }),

        alphaChatSetReaction: withAccount(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.messageId), uid, args.reaction);
            return 'ok';
        }),
        alphaChatUnsetReaction: withAccount(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.messageId), uid, args.reaction, true);
            return 'ok';
        }),
    }
};
