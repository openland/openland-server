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
import { JsonMap } from '../../openland-utils/json';
import { IDMailformedError } from '../../openland-errors/IDMailformedError';
import { UserError } from '../../openland-errors/UserError';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { Sanitizer } from '../../openland-utils/Sanitizer';
import { URLAugmentation } from '../workers/UrlInfoService';
import { Modules } from 'openland-modules/Modules';
import { UserDialogSettings, Message, RoomParticipant, Conversation, Organization, User } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { withLogContext } from 'openland-log/withLogContext';
import { FDB } from 'openland-module-db/FDB';
import { FEntity } from 'foundation-orm/FEntity';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';

export default {
    Conversation: {
        __resolveType: async (src: Conversation) => {
            if (src.kind === 'private') {
                return 'PrivateConversation';
            } else if (src.kind === 'organization') {
                return 'SharedConversation';
            } else {
                let room = (await FDB.ConversationRoom.findById(src.id!));
                if (!room) {
                    console.warn('Unable to find room: ' + src.id);
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
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: async (src: Conversation, _: any, ctx: AppContext) => {
            return IDs.Conversation.serialize((await FDB.ConversationOrganization.findById(src.id))!.oid);
        },
        title: async (src: Conversation, _: any, ctx: AppContext) => {
            return (await FDB.OrganizationProfile.findById((await FDB.ConversationOrganization.findById(src.id))!.oid))!.name;
        },
        photos: async (src: Conversation, _: any, ctx: AppContext) => {
            let p = (await FDB.OrganizationProfile.findById((await FDB.ConversationOrganization.findById(src.id))!.oid))!.photo;
            if (p) {
                return [buildBaseImageUrl(p)];
            } else {
                return [];
            }
        },
        unreadCount: async (src: Conversation, _: any, ctx: AppContext) => {
            let state = await FDB.UserDialog.findById(ctx.auth.uid!, src.id);
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => Modules.Messaging.findTopMessage(src.id!),
        organization: async (src: Conversation, _: any, ctx: AppContext) => {
            return FDB.OrganizationProfile.findById((await FDB.ConversationOrganization.findById(src.id))!.oid);
        },
        settings: (src: Conversation, _: any, ctx: AppContext) => Modules.Messaging.getRoomSettings(ctx.auth.uid!!, src.id),
        organizations: () => []
    },
    PrivateConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: async (src: Conversation, _: any, ctx: AppContext) => {
            let conv = (await FDB.ConversationPrivate.findById(src.id))!;
            if (!conv) {
                console.warn('Unable to find private conversation: ' + src.id);
            }
            if (conv.uid1 === ctx.auth.uid) {
                return IDs.User.serialize(conv.uid2);
            } else if (conv.uid2 === ctx.auth.uid) {
                return IDs.User.serialize(conv.uid1);
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
        },
        title: async (src: Conversation, _: any, ctx: AppContext) => {
            let uid;
            let conv = (await FDB.ConversationPrivate.findById(src.id))!;
            if (conv.uid1 === ctx.auth.uid) {
                uid = conv.uid2;
            } else if (conv.uid2 === ctx.auth.uid) {
                uid = conv.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await Modules.Users.profileById(uid))!;
            return [profile.firstName, profile.lastName].filter((v) => !!v).join(' ');
        },
        photos: async (src: Conversation, _: any, ctx: AppContext) => {
            let uid;
            let conv = (await FDB.ConversationPrivate.findById(src.id))!;
            if (conv.uid1 === ctx.auth.uid) {
                uid = conv.uid2;
            } else if (conv.uid2 === ctx.auth.uid) {
                uid = conv.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await Modules.Users.profileById(uid))!;

            if (profile.picture) {
                return [buildBaseImageUrl(profile.picture)];
            } else {
                return [];
            }
        },
        unreadCount: async (src: Conversation, _: any, ctx: AppContext) => {
            let state = await FDB.UserDialog.findById(ctx.auth.uid!, src.id);
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => Modules.Messaging.findTopMessage(src.id!),
        user: async (src: Conversation, _: any, ctx: AppContext) => {
            let uid;
            let conv = (await FDB.ConversationPrivate.findById(src.id))!;
            if (conv.uid1 === ctx.auth.uid) {
                uid = conv.uid2;
            } else if (conv.uid2 === ctx.auth.uid) {
                uid = conv.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            return FDB.User.findById(uid);
        },
        blocked: async (src: Conversation, _: any, ctx: AppContext) => false,
        settings: (src: Conversation, _: any, ctx: AppContext) => Modules.Messaging.getRoomSettings(ctx.auth.uid!!, src.id),
    },
    GroupConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: async (src: Conversation, _: any, ctx: AppContext) => {
            let conv = (await FDB.RoomProfile.findById(src.id))!;
            if (!conv) {
                console.warn('Unable to find room for id: ' + src.id);
            }
            if (conv.title !== '') {
                return conv.title;
            }
            let res = (await FDB.RoomParticipant.allFromActive(src.id)).filter((v) => v.uid !== ctx.auth.uid);
            let name: string[] = [];
            for (let r of res) {
                let p = (await Modules.Users.profileById(r.uid))!;
                name.push([p.firstName, p.lastName].filter((v) => !!v).join(' '));
            }
            return name.join(', ');
        },
        photos: async (src: Conversation, _: any, ctx: AppContext) => {
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
        members: async (src: Conversation) => {
            let res = await FDB.RoomParticipant.allFromActive(src.id);
            return Promise.all(res.map((v) => FDB.User.findById(v.uid)));
        },
        unreadCount: async (src: Conversation, _: any, ctx: AppContext) => {
            let state = await FDB.UserDialog.findById(ctx.auth.uid!!, src.id);
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: async (src: Conversation, _: any, ctx: AppContext) => {
            if (!await Modules.Messaging.room.isRoomMember(ctx.auth.uid!, src.id)) {
                return null;
            }

            return Modules.Messaging.findTopMessage(src.id!);
        },
        membersCount: (src: Conversation) => Modules.Messaging.roomMembersCount(src.id),
        settings: (src: Conversation, _: any, ctx: AppContext) => Modules.Messaging.getRoomSettings(ctx.auth.uid!, src.id),

        photo: async (src: Conversation) => buildBaseImageUrl((await FDB.RoomProfile.findById(src.id))!.image),
        photoRef: async (src: Conversation) => (await FDB.RoomProfile.findById(src.id))!.image,
        description: async (src: Conversation) => (await FDB.RoomProfile.findById(src.id))!.description as string,
        longDescription: (src: Conversation) => '',
        pinnedMessage: (src: Conversation) => null,
        membersOnline: async (src: Conversation) => {
            // let res = await DB.ConversationGroupMembers.findAll({
            //     where: {
            //         conversationId: src.id
            //     },
            //     order: ['userId']
            // });
            // let users = await Promise.all(res.map((v) => DB.User.findById(v.userId)));

            // let now = Date.now();
            // let online = users.map(user => {
            //     // if (user!.lastSeen) {
            //     //     return user!.lastSeen!.getTime() > now;
            //     // } else {
            //     //     return false;
            //     // }
            // });

            // return online.filter(o => o === true).length;
            return 0;
        },
        myRole: async (src: Conversation, _: any, ctx: AppContext) => {
            let member = await Modules.Messaging.room.findMembershipStatus(ctx.auth.uid!, src.id);

            return member && member.role;
        },
    },

    MessageReaction: {
        user: (src: any) => FDB.User.findById(src.userId),
        reaction: (src: any) => src.reaction
    },
    UrlAugmentationExtra: {
        __resolveType(src: any) {
            if ((src instanceof (FEntity) && src.entityName === 'User')) {
                return 'User';
            } else if ((src instanceof (FEntity) && src.entityName === 'Organization')) {
                return 'Organization';
            } else if ((src instanceof (FEntity) && src.entityName === 'Conversation')) {
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
        imageURL: (src: URLAugmentation) => src.imageURL,
        imageInfo: (src: URLAugmentation) => src.imageInfo,
        photo: (src: URLAugmentation) => src.photo,
        iconRef: (src: URLAugmentation) => src.iconRef,
        iconInfo: (src: URLAugmentation) => src.iconInfo,
        hostname: (src: URLAugmentation) => src.hostname,
        type: (src: URLAugmentation) => src.type,
        extra: async (src: URLAugmentation) => {
            if (src.type === 'url') {
                return null;
            } else if (src.type === 'user') {
                return FDB.User.findById(src.extra);
            } else if (src.type === 'org') {
                return FDB.Organization.findById(src.extra);
            } else if (src.type === 'channel') {
                return FDB.Conversation.findById(src.extra);
            } else if (src.type === 'intro') {
                return FDB.User.findById(src.extra);
            }

            return null;
        },
        date: () => ''
    },
    ConversationMessage: {
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
        sender: (src: Message, _: any, ctx: AppContext) => FDB.User.findById(src.uid),
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
    InviteServiceMetadata: {
        users: (src: any) => src.userIds.map((id: number) => FDB.User.findById(id)),
        invitedBy: (src: any) => FDB.User.findById(src.invitedById)
    },
    KickServiceMetadata: {
        user: resolveUser(),
        kickedBy: (src: any) => FDB.User.findById(src.kickedById)
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
            }

            throw new Error('Unknown type');
        }
    },
    PhotoChangeServiceMetadata: {
        photo: (src: any) => src.picture ? buildBaseImageUrl(src.extras.picture as any) : null,
        photoRef: (src: any) => src.picture,
    },
    ChatReadResult: {
        conversation: (src: { uid: number, conversationId: number }) => FDB.Conversation.findById(src.conversationId),
        counter: (src: { uid: number, conversationId: number }) => src.uid
    },
    ComposeSearchResult: {
        __resolveType(obj: User | Organization) {
            // WTF, sequelize? Why Model is undefined??
            if (obj.entityName === 'User') {
                return 'User';
            } else if (obj.entityName === 'Organization') {
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
        unreadCount: async (src: number | { uid: number, counter: number }) => {
            if (typeof src === 'number') {
                let global = await FDB.UserMessagingState.findById(src);
                if (global) {
                    return global.unread;
                } else {
                    return 0;
                }
            } else {
                return src.counter;
            }
        }
    },

    GroupConversationMember: {
        role: (src: RoomParticipant) => src.role === 'owner' ? 'creator' : src.role,
        user: (src: RoomParticipant) => FDB.User.findById(src.uid)
    },

    ConversationSettings: {
        id: (src: UserDialogSettings) => IDs.ConversationSettings.serialize(src.cid),
        mute: (src: UserDialogSettings) => src.mute,
        mobileNotifications: (src: UserDialogSettings) => 'all' as any
    },

    Query: {
        alphaNotificationCounter: withUser((ctx, args, uid) => uid),
        alphaChat: withAccount<GQL.QueryAlphaChatArgs>(async (ctx, args, uid, oid) => {
            if (args.shortName) {
                let shortName = await Modules.Shortnames.findShortname(args.shortName);
                if (!shortName) {
                    throw new NotFoundError();
                }

                if (shortName.ownerType === 'user') {
                    return Modules.Messaging.room.resolvePrivateChat(shortName.ownerId!, uid);
                } // else if (shortName.ownerType === 'org') {
                // return Repos.Chats.loadOrganizationalChat(oid, shortName.ownerId!);
                // } else {
                throw new NotFoundError();
                // }
            } else if (args.conversationId) {
                let id = IdsFactory.resolve(args.conversationId);
                if (id.type === IDs.Conversation) {
                    return FDB.Conversation.findById(id.id);
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
            } else {
                throw new UserError('No id passed');
            }
        }),
        alphaLoadMessages: withUser<GQL.QueryAlphaLoadMessagesArgs>(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);

            await Modules.Messaging.room.checkAccess(uid, conversationId);

            let beforeMessage: Message | null = null;
            if (args.before) {
                beforeMessage = await FDB.Message.findById(IDs.ConversationMessage.parse(args.before));
            }

            if (beforeMessage) {
                return {
                    seq: 0,
                    messages: await FDB.Message.rangeFromChatAfter(conversationId, beforeMessage.id, args.first!, true)
                };
            }

            return {
                seq: 0,
                messages: await FDB.Message.rangeFromChat(conversationId, args.first!, true)
            };
        }),
        alphaChatsSearchForCompose: withAccount<GQL.QueryAlphaChatsSearchForComposeArgs>(async (ctx, args, uid, oid) => {

            // Do search
            let uids = await Modules.Users.searchForUsers(args.query || '', {
                uid,
                limit: args.limit || 10
            });

            if (uids.length === 0) {
                return [];
            }

            // Fetch profiles
            let users = (await Promise.all(uids.map((v) => FDB.User.findById(v)))).filter((v) => v && v.status === 'activated');
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
        alphaChatSearch: withUser<GQL.QueryAlphaChatSearchArgs>(async (ctx, args, uid) => {
            let members = [...args.members.map((v) => IDs.User.parse(v)), uid];
            let groups = await FDB.RoomParticipant.allFromUserActive(uid);
            let suitableGroups: number[] = [];
            for (let f of groups) {
                let allMembers = await FDB.RoomParticipant.allFromActive(f.cid);
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
            // return await FDB.Conversation.find({
            //     where: {
            //         id: {
            //             $in: suitableGroups
            //         }
            //     },
            //     order: [['updatedAt', 'DESC']],
            //     transaction: tx
            // });
            return null;
        }),
        alphaGroupConversationMembers: withUser<GQL.QueryAlphaGroupConversationMembersArgs>(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let res = await FDB.RoomParticipant.allFromActive(conversationId);
            return res;
        }),
    },
    Mutation: {
        alphaReadChat: withUser<GQL.MutationAlphaReadChatArgs>(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            await Modules.Messaging.readRoom(uid, conversationId, messageId);
            return {
                uid: uid,
                conversationId: conversationId
            };
        }),
        alphaGlobalRead: withUser<GQL.MutationAlphaGlobalReadArgs>(async (ctx, args, uid) => {
            await Modules.Messaging.markAsSeqRead(uid, args.toSeq);
            return 'ok';
        }),
        alphaSendMessage: withUser<GQL.MutationAlphaSendMessageArgs>(async (ctx, args, uid) => {
            // validate({ message: stringNotEmpty() }, args);
            return await withLogContext('send-message', async () => {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                let fileMetadata: JsonMap | null = null;
                let filePreview: string | null = null;

                if (args.file) {
                    let fileInfo = await Modules.Media.saveFile(args.file);
                    fileMetadata = fileInfo as any;

                    if (fileInfo.isImage) {
                        filePreview = await Modules.Media.fetchLowResPreview(args.file);
                    }
                }

                let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));
                let mentions = args.mentions && args.mentions.map(id => IDs.User.parse(id));

                return Modules.Messaging.sendMessage(conversationId, uid!, {
                    message: args.message,
                    file: args.file,
                    fileMetadata,
                    repeatKey: args.repeatKey,
                    filePreview,
                    replyMessages,
                    mentions
                });
            });
        }),
        alphaSendIntro: withUser<GQL.MutationAlphaSendIntroArgs>(async (ctx, args, uid) => {
            console.log(args);
            await validate({
                about: defined(stringNotEmpty(`About can't be empty!`)),
                userId: defined(stringNotEmpty('Select user'))
            }, args);

            let userId = IDs.User.parse(args.userId);
            let conversationId = IDs.Conversation.parse(args.conversationId);

            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;

            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(args.file);
                }
            }

            let profile = (await Modules.Users.profileById(userId))!;

            if (!profile) {
                throw new NotFoundError();
            }

            return (await Modules.Messaging.sendMessage(conversationId, uid!, {
                message: args.message,
                file: args.file,
                fileMetadata,
                repeatKey: args.repeatKey,
                filePreview,
                urlAugmentation: {
                    type: 'intro',
                    extra: userId,
                    url: `https://next.openland.com/mail/u/${IDs.User.serialize(userId)}`,
                    title: profile.firstName + ' ' + profile.lastName,
                    subtitle: 'intro',
                    description: args.about || '',
                    imageURL: null,
                    imageInfo: null,
                    photo: profile!.picture,
                    hostname: 'openland.com',
                    iconRef: null,
                    iconInfo: null,
                }
            }));
        }),
        alphaEditIntro: withUser<GQL.MutationAlphaEditIntroArgs>(async (ctx, args, uid) => {
            await validate(
                {
                    about: defined(stringNotEmpty(`About can't be empty!`)),
                    userId: defined(stringNotEmpty('Select user'))
                },
                args
            );

            let userId = IDs.User.parse(args.userId);
            let messageId = IDs.ConversationMessage.parse(args.messageId);

            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;

            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(args.file);
                }
            }

            let profile = (await Modules.Users.profileById(userId))!;

            if (!profile) {
                throw new NotFoundError();
            }

            return await Modules.Messaging.editMessage(messageId, uid!, {
                message: args.message,
                file: args.file,
                fileMetadata,
                filePreview,
                urlAugmentation: {
                    type: 'intro',
                    extra: args.userId,
                    url: `https://next.openland.com/mail/u/${IDs.User.serialize(userId)}`,
                    title: profile.firstName + ' ' + profile.lastName,
                    subtitle: 'intro',
                    description: args.about || '',
                    imageURL: null,
                    imageInfo: null,
                    photo: profile!.picture,
                    hostname: 'openland.com',
                    iconRef: null,
                    iconInfo: null,
                }
            }, true);
        }),
        alphaEditMessage: withUser<GQL.MutationAlphaEditMessageArgs>(async (ctx, args, uid) => {
            let fileMetadata: JsonMap | null = null;
            let filePreview: string | null = null;

            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(args.file);
                }
            }

            let messageId = IDs.ConversationMessage.parse(args.messageId);

            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));
            let mentions = args.mentions && args.mentions.map(id => IDs.User.parse(id));

            return await Modules.Messaging.editMessage(messageId, uid, {
                message: args.message,
                file: args.file,
                fileMetadata,
                filePreview,
                replyMessages,
                mentions
            }, true);
        }),
        alphaDeleteMessageUrlAugmentation: withUser<GQL.MutationAlphaDeleteMessageUrlAugmentationArgs>(async (ctx, args, uid) => {
            return await Modules.Messaging.editMessage(IDs.ConversationMessage.parse(args.messageId), uid, {
                urlAugmentation: false
            }, true);
        }),
        alphaDeleteMessage: withUser<GQL.MutationAlphaDeleteMessageArgs>(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            return await Modules.Messaging.deleteMessage(messageId, uid);
        }),

        //
        // Group Management
        //

        alphaChatCreateGroup: withAccount<GQL.MutationAlphaChatCreateGroupArgs>(async (ctx, args, uid, oid) => {
            let title = args.title ? args.title!! : '';
            let imageRef = Sanitizer.sanitizeImageRef(args.photoRef);
            if (imageRef) {
                await Modules.Media.saveFile(imageRef.uuid);
            }
            return Modules.Messaging.room.createRoom('group', oid, uid, args.members.map((v) => IDs.User.parse(v)), {
                title: title,
                image: imageRef
            }, args.message || '');
        }),
        alphaChatUpdateGroup: withUser<GQL.MutationAlphaChatUpdateGroupArgs>(async (ctx, args, uid) => {
            await validate(
                {
                    title: optional(stringNotEmpty('Title can\'t be empty!'))
                },
                args.input
            );

            let conversationId = IDs.Conversation.parse(args.conversationId);

            let imageRef = Sanitizer.sanitizeImageRef(args.input.photoRef);
            if (args.input.photoRef) {
                await Modules.Media.saveFile(args.input.photoRef.uuid);
            }

            let socialImageRef = Sanitizer.sanitizeImageRef(args.input.socialImageRef);
            if (args.input.socialImageRef) {
                await Modules.Media.saveFile(args.input.socialImageRef.uuid);
            }

            let conv = await Modules.Messaging.room.updateRoomProfile(conversationId, uid, {
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
        alphaChatInviteToGroup: withUser<GQL.MutationAlphaChatInviteToGroupArgs>(async (ctx, args, uid) => {
            await validate({
                invites: mustBeArray({
                    userId: defined(stringNotEmpty()),
                    role: defined(enumString(['member', 'admin']))
                })
            }, args);

            let conversationId = IDs.Conversation.parse(args.conversationId);

            let members = args.invites.map((v) => IDs.User.parse(v.userId));

            let chat = await Modules.Messaging.room.inviteToRoom(conversationId, uid, members);
            return {
                chat
            };
        }),
        alphaChatKickFromGroup: withUser<GQL.MutationAlphaChatKickFromGroupArgs>(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let userId = IDs.User.parse(args.userId);
            return inTx(async () => {
                if (uid === userId) {
                    let chat = await Modules.Messaging.room.leaveRoom(conversationId, uid);
                    return {
                        chat
                    };
                } else {
                    let chat = await Modules.Messaging.room.kickFromRoom(conversationId, uid, userId);
                    return {
                        chat
                    };
                }

            });
        }),
        alphaChatChangeRoleInGroup: withUser<GQL.MutationAlphaChatChangeRoleInGroupArgs>(async (ctx, args, uid) => {
            await validate({
                newRole: defined(enumString(['member', 'admin']))
            }, args);

            let conversationId = IDs.Conversation.parse(args.conversationId);
            let userId = IDs.User.parse(args.userId);

            let conv = await Modules.Messaging.room.updateMemberRole(conversationId, uid, userId, args.newRole as any);

            return {
                chat: conv
            };
        }),

        alphaBlockUser: withUser<GQL.MutationAlphaBlockUserArgs>(async (ctx, args, uid) => {
            return 'ok';
        }),
        alphaUnblockUser: withUser<GQL.MutationAlphaUnblockUserArgs>(async (ctx, args, uid) => {
            return 'ok';
        }),
        alphaUpdateConversationSettings: withUser<GQL.MutationAlphaUpdateConversationSettingsArgs>(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.conversationId);
            return await inTx(async () => {
                let settings = await Modules.Messaging.getRoomSettings(uid, cid);
                if (args.settings.mute !== undefined && args.settings.mute !== null) {
                    settings.mute = args.settings.mute;
                }
                return settings;
            });
        }),
        alphaChatLeave: withAccount<GQL.MutationAlphaChatLeaveArgs>(async (ctx, args, uid) => {
            return inTx(async () => {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                let res = await Modules.Messaging.room.leaveRoom(conversationId, uid);

                return {
                    chat: res
                };
            });
        }),

        alphaChatSetReaction: withAccount<GQL.MutationAlphaChatSetReactionArgs>(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(IDs.ConversationMessage.parse(args.messageId), uid, args.reaction);
            return 'ok';
        }),
        alphaChatUnsetReaction: withAccount<GQL.MutationAlphaChatUnsetReactionArgs>(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(IDs.ConversationMessage.parse(args.messageId), uid, args.reaction, true);
            return 'ok';
        }),
    }
} as GQLResolver;