import { ConversationMessage } from '../tables/ConversationMessage';
import { IDs, IdsFactory } from './utils/IDs';
import { Conversation } from '../tables/Conversation';
import { DB, User } from '../tables';
import { withPermission, withAny, withAccount, withUser, resolveUser } from './utils/Resolvers';
import { validate, stringNotEmpty, enumString, optional, defined, mustBeArray } from '../modules/NewInputValidator';
import { ConversationEvent } from '../tables/ConversationEvent';
import { CallContext } from './utils/CallContext';
import { Repos } from '../repositories';
import { ConversationUserEvents } from '../tables/ConversationUserEvents';
import { JsonMap } from '../utils/json';
import { IDMailformedError } from '../errors/IDMailformedError';
import { ImageRef, buildBaseImageUrl, imageRefEquals } from '../repositories/Media';
import { Organization } from '../tables/Organization';
import { TypingEvent } from '../repositories/ChatRepository';
import { ConversationGroupMember } from '../tables/ConversationGroupMembers';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { ConversationBlocked } from '../tables/ConversationBlocked';
import { Services } from '../services';
import { UserError } from '../errors/UserError';
import { NotFoundError } from '../errors/NotFoundError';
import { UserProfile } from '../tables/UserProfile';
import { Sanitizer } from '../modules/Sanitizer';

export const Resolver = {
    Conversation: {
        __resolveType: (src: Conversation) => {
            if (src.type === 'anonymous') {
                return 'AnonymousConversation';
            } else if (src.type === 'shared') {
                return 'SharedConversation';
            } else if (src.type === 'private') {
                return 'PrivateConversation';
            } else if (src.type === 'group') {
                return 'GroupConversation';
            } else if (src.type === 'channel') {
                return 'ChannelConversation';
            } else {
                throw Error('Unsupported Conversation Type');
            }
        },
    },
    AnonymousConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: (src: Conversation) => src.title,
        photos: (src: Conversation) => [],
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({where: {conversationId: src.id, userId: context.uid!!}});
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => DB.ConversationMessage.find({
            where: {
                conversationId: src.id,
            },
            order: [['id', 'DESC']]
        }),
        settings: (src: Conversation, _: any, context: CallContext) => Repos.Chats.getConversationSettings(context.uid!!, src.id),
    },
    SharedConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation, _: any, context: CallContext) => {
            if (src.organization1Id === context.oid || (src.organization1 && src.organization1.id === context.oid)) {
                return IDs.Organization.serialize(src.organization2Id!!);
            } else if (src.organization2Id === context.oid || (src.organization2 && src.organization2.id === context.oid)) {
                return IDs.Organization.serialize(src.organization1Id!!);
            } else {
                return IDs.Conversation.serialize(src.id);
                // console.warn(src);
                // console.warn(context);
                // throw Error('Inconsistent Shared Conversation resolver');
            }
        },
        title: async (src: Conversation, _: any, context: CallContext) => {
            if (src.organization1Id === context.oid || (src.organization1 && src.organization1.id === context.oid)) {
                return (src.organization2 || await src.getOrganization2())!!.name;
            } else if (src.organization2Id === context.oid || (src.organization2 && src.organization2.id === context.oid)) {
                return (src.organization1 || await src.getOrganization1())!!.name;
            } else {
                let org1 = (src.organization1 || await src.getOrganization2())!!;
                let org2 = (src.organization2 || await src.getOrganization2())!!;
                if (org1.id === org2.id) {
                    return org1.name;
                }
                return org1.name + ', ' + org2.name;
            }
        },
        photos: async (src: Conversation, _: any, context: CallContext) => {
            let photo: ImageRef | null = null;
            if (src.organization1Id === context.oid || (src.organization1 && src.organization1.id === context.oid)) {
                photo = (src.organization2 || await src.getOrganization2())!!.photo!!;
            } else if (src.organization2Id === context.oid || (src.organization2 && src.organization2.id === context.oid)) {
                photo = (src.organization1 || await src.getOrganization1())!!.photo!!;
            } else {
               // it can be inner shared conversation from another org of this user
               photo = (src.organization1 || await src.getOrganization1())!!.photo!!;
            }
            if (photo) {
                return [buildBaseImageUrl(photo)];
            } else {
                return [];
            }
        },
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({where: {conversationId: src.id, userId: context.uid!!}});
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => DB.ConversationMessage.find({
            where: {
                conversationId: src.id,
            },
            order: [['id', 'DESC']]
        }),
        organization: async (src: Conversation, _: any, context: CallContext) => {
            if (src.organization1Id === context.oid || (src.organization1 && src.organization1.id === context.oid)) {
                return (src.organization2 || await src.getOrganization2())!!;
            } else if (src.organization2Id === context.oid || (src.organization2 && src.organization2.id === context.oid)) {
                return (src.organization1 || await src.getOrganization1())!!;
            }
            return undefined;
        },
        settings: (src: Conversation, _: any, context: CallContext) => Repos.Chats.getConversationSettings(context.uid!!, src.id),
    },
    PrivateConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation, _: any, context: CallContext) => {
            let uid;
            if (src.member1Id === context.uid || (src.member1 && src.member1.id === context.uid)) {
                uid = src.member2Id!!;
            } else if (src.member2Id === context.uid || (src.member2 && src.member2.id === context.uid)) {
                uid = src.member1Id!!;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            return IDs.User.serialize(uid);
        },
        title: async (src: Conversation, _: any, context: CallContext) => {
            let uid;
            if (src.member1Id === context.uid || (src.member1 && src.member1.id === context.uid)) {
                uid = src.member2Id!!;
            } else if (src.member2Id === context.uid || (src.member2 && src.member2.id === context.uid)) {
                uid = src.member1Id!!;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await DB.UserProfile.find({
                where: {
                    userId: uid
                }
            }))!!;
            return [profile.firstName, profile.lastName].filter((v) => !!v).join(' ');
        },
        photos: async (src: Conversation, _: any, context: CallContext) => {
            let uid;
            if (src.member1Id === context.uid || (src.member1 && src.member1.id === context.uid)) {
                uid = src.member2Id!!;
            } else if (src.member2Id === context.uid || (src.member2 && src.member2.id === context.uid)) {
                uid = src.member1Id!!;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await DB.UserProfile.find({
                where: {
                    userId: uid
                }
            }))!!;

            if (profile.picture) {
                return [buildBaseImageUrl(profile.picture)];
            } else {
                return [];
            }
        },
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({where: {conversationId: src.id, userId: context.uid!!}});
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => DB.ConversationMessage.find({
            where: {
                conversationId: src.id,
            },
            order: [['id', 'DESC']]
        }),
        user: async (src: Conversation, _: any, context: CallContext) => {
            let uid;
            if (src.member1Id === context.uid || (src.member1 && src.member1.id === context.uid)) {
                uid = src.member2Id!!;
            } else if (src.member2Id === context.uid || (src.member2 && src.member2.id === context.uid)) {
                uid = src.member1Id!!;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            return DB.User.findById(uid);
        },
        blocked: async (src: Conversation, _: any, context: CallContext) => !!(await DB.ConversationBlocked.findOne({
            where: {
                user: src.member1Id === context.uid ? src.member2Id : src.member1Id,
                conversation: null
            }
        })),
        settings: (src: Conversation, _: any, context: CallContext) => Repos.Chats.getConversationSettings(context.uid!!, src.id),
    },
    GroupConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: async (src: Conversation, _: any, context: CallContext) => {
            if (src.title !== '') {
                return src.title;
            }
            let res = await DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId: src.id,
                    userId: {
                        $not: context.uid
                    }
                },
                order: ['userId']
            });
            let name: string[] = [];
            for (let r of res) {
                let p = (await DB.UserProfile.find({where: {userId: r.userId}}))!!;
                name.push([p.firstName, p.lastName].filter((v) => !!v).join(' '));
            }
            return name.join(', ');
        },
        photos: async (src: Conversation, _: any, context: CallContext) => {
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
            let res = await DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId: src.id
                },
                order: ['userId']
            });
            return res.map((v) => DB.User.findById(v.userId));
        },
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({where: {conversationId: src.id, userId: context.uid!!}});
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: async (src: Conversation, _: any, context: CallContext) => {
            let member = await DB.ConversationGroupMembers.find({
                where: {
                    conversationId: src.id,
                    userId: context.uid,
                    status: 'member'
                }
            });

            if (!member) {
                return null;
            }

            return await DB.ConversationMessage.find({
                where: {
                    conversationId: src.id,
                },
                order: [['id', 'DESC']]
            });
        },
        membersCount: (src: Conversation) => Repos.Chats.membersCountInConversation(src.id),
        settings: (src: Conversation, _: any, context: CallContext) => Repos.Chats.getConversationSettings(context.uid!!, src.id),

        photo: (src: Conversation) => src.extras && src.extras.picture ? buildBaseImageUrl(src.extras.picture as any) : null,
        photoRef: (src: Conversation) => src.extras && src.extras.picture,
        description: (src: Conversation) => src.extras.description || '',
        longDescription: (src: Conversation) => src.extras.longDescription || '',
    },

    ConversationMessage: {
        id: (src: ConversationMessage) => IDs.ConversationMessage.serialize(src.id),
        message: (src: ConversationMessage) => src.message,
        file: (src: ConversationMessage) => src.fileId,
        fileMetadata: (src: ConversationMessage) => {
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
        filePreview: (src: ConversationMessage) => src.extras.filePreview || null,
        sender: (src: ConversationMessage, _: any, context: CallContext) => Repos.Users.userLoader(context).load(src.userId),
        date: (src: ConversationMessage) => src.createdAt,
        repeatKey: (src: ConversationMessage, args: any, context: CallContext) => src.userId === context.uid ? src.repeatToken : null,
        isService: (src: ConversationMessage) => src.isService,
        serviceMetadata: (src: ConversationMessage) => {
            if (src.extras && src.extras.serviceMetadata && (src.extras.serviceMetadata as any).type) {
                return src.extras.serviceMetadata;
            }

            return null;
        },
        urlAugmentation: (src: ConversationMessage) => src.extras && src.extras.urlAugmentation,
        edited: (src: ConversationMessage) => src.extras && src.extras.edited
    },
    InviteServiceMetadata: {
        users: (src: any) => src.userIds.map((id: number) => DB.User.findById(id)),
        invitedBy: (src: any) => DB.User.findById(src.invitedById)
    },
    KickServiceMetadata: {
        user: resolveUser(),
        kickedBy: (src: any) => DB.User.findById(src.kickedById)
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

    ConversationEvent: {
        __resolveType(obj: ConversationEvent) {
            if (obj.eventType === 'new_message') {
                return 'ConversationEventMessage';
            } else if (obj.eventType === 'delete_message') {
                return 'ConversationEventDelete';
            } else if (obj.eventType === 'title_change') {
                return 'ConversationEventTitle';
            } else if (obj.eventType === 'new_members') {
                return 'ConversationEventNewMembers';
            } else if (obj.eventType === 'kick_member') {
                return 'ConversationEventKick';
            } else if (obj.eventType === 'update_role') {
                return 'ConversationEventUpdateRole';
            } else if (obj.eventType === 'edit_message') {
                return 'ConversationEventEditMessage';
            } else if (obj.eventType === 'chat_update') {
                return 'ConversationEventUpdate';
            }
            throw Error('Unknown type');
        },
        seq: (src: ConversationEvent) => src.seq
    },
    ConversationEventMessage: {
        message: (src: ConversationEvent) => DB.ConversationMessage.findById(src.event.messageId as number)
    },
    ConversationEventEditMessage: {
        message: (src: ConversationEvent) => DB.ConversationMessage.findById(src.event.messageId as number)
    },
    ConversationEventDelete: {
        messageId: (src: ConversationEvent) => IDs.ConversationMessage.serialize(src.event.messageId as number)
    },
    ConversationEventTitle: {
        title: (src: ConversationEvent) => src.event.title
    },
    ConversationEventNewMembers: {
        users: (src: ConversationEvent) => (src.event.userIds! as any).map((id: number) => DB.User.findById(id)),
        invitedBy: (src: any) => DB.User.findById(src.event.invitedById)
    },
    ConversationEventKick: {
        user: (src: ConversationEvent) => DB.User.findById(src.event.userId as any),
        kickedBy: (src: ConversationEvent) => DB.User.findById(src.event.kickedById as any)
    },
    ConversationEventUpdateRole: {
        user: (src: ConversationEvent) => DB.User.findById(src.event.userId as any),
        newRole: (src: ConversationEvent) => src.event.newRole
    },
    ConversationEventUpdate: {
        chat: (src: ConversationEvent) => DB.Conversation.findById(src.conversationId)
    },
    ChatReadResult: {
        conversation: (src: { uid: number, conversationId: number }) => DB.Conversation.findById(src.conversationId),
        counter: (src: { uid: number, conversationId: number }) => src.uid
    },

    UserEvent: {
        __resolveType(obj: ConversationUserEvents) {
            if (obj.eventType === 'new_message') {
                return 'UserEventMessage';
            } else if (obj.eventType === 'conversation_read') {
                return 'UserEventRead';
            } else if (obj.eventType === 'title_change') {
                return 'UserEventTitleChange';
            } else if (obj.eventType === 'new_members_count') {
                return 'UserEventNewMembersCount';
            } else if (obj.eventType === 'edit_message') {
                return 'UserEventEditMessage';
            } else if (obj.eventType === 'chat_update') {
                return 'UserEventConversationUpdate';
            } else if (obj.eventType === 'delete_message') {
                return 'UserEventDeleteMessage';
            }
            throw Error('Unknown type');
        }
    },
    UserEventMessage: {
        seq: (src: ConversationUserEvents) => src.seq,
        unread: (src: ConversationUserEvents) => src.event.unread,
        globalUnread: (src: ConversationUserEvents) => src.event.unreadGlobal,
        conversationId: (src: ConversationUserEvents) => IDs.Conversation.serialize(src.event.conversationId as any),
        message: (src: ConversationUserEvents) => DB.ConversationMessage.findById(src.event.messageId as any),
        conversation: (src: ConversationUserEvents) => DB.Conversation.findById(src.event.conversationId as any),
        isOut: (src: ConversationUserEvents, args: any, context: CallContext) => src.event.senderId === context.uid,
        repeatKey: (src: ConversationUserEvents, args: any, context: CallContext) => src.event.senderId === context.uid ? DB.ConversationMessage.findById(src.event.messageId as any).then((v) => v && v.repeatToken) : null
    },
    UserEventRead: {
        seq: (src: ConversationUserEvents) => src.seq,
        unread: (src: ConversationUserEvents) => src.event.unread,
        globalUnread: (src: ConversationUserEvents) => src.event.unreadGlobal,
        conversationId: (src: ConversationUserEvents) => IDs.Conversation.serialize(src.event.conversationId as any),
    },
    UserEventTitleChange: {
        seq: (src: ConversationUserEvents) => src.seq,
        title: (src: ConversationUserEvents) => src.event.title,
    },
    UserEventNewMembersCount: {
        conversationId: (src: ConversationUserEvents) => IDs.Conversation.serialize(src.event.conversationId as any),
        membersCount: (src: ConversationUserEvents) => src.event.membersCount
    },
    UserEventEditMessage: {
        seq: (src: ConversationUserEvents) => src.seq,
        message: (src: ConversationUserEvents) => DB.ConversationMessage.findById(src.event.messageId as any)
    },
    UserEventDeleteMessage: {
        seq: (src: ConversationUserEvents) => src.seq,
        message: (src: ConversationUserEvents) => DB.ConversationMessage.findById(src.event.messageId as any)
    },
    UserEventConversationUpdate: {
        seq: (src: ConversationUserEvents) => src.seq,
        chat: (src: ConversationUserEvents) => DB.Conversation.findById(src.event.conversationId as any),
    },

    ComposeSearchResult: {
        __resolveType(obj: User | Organization) {
            // WTF, sequelize? Why Model is undefined??
            if (obj.constructor.name === 'user') {
                return 'User';
            } else if (obj.constructor.name === 'organization') {
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
                let global = await DB.ConversationsUserGlobal.find({where: {userId: src}});
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

    TypingEvent: {
        type: (src: TypingEvent) => src.type,
        cancel: (src: TypingEvent) => src.cancel,
        conversation: (src: TypingEvent) => DB.Conversation.findById(src.conversationId),
        user: (src: TypingEvent) => DB.User.findById(src.userId),
    },

    GroupConversationMember: {
        role: (src: ConversationGroupMember) => src.role,
        user: resolveUser<ConversationGroupMember>()
    },

    ConversationBlockedUser: {
        user: (src: ConversationBlocked) => DB.User.findOne({where: {id: src.user}}),
        blockedBy: (src: ConversationBlocked) => DB.User.findOne({where: {id: src.blockedBy}}),
    },

    Query: {
        alphaFilePreviewLink: withAny<{ uuid: string }>(async (args) => {
            let res = await Services.BoxPreview.uploadToBox(args.uuid);
            if (!res.fileExists) {
                throw new NotFoundError();
            }
            if (!res.boxAllowed) {
                throw new UserError('Preview are available only for files less than 15 mb');
            }
            return await Services.BoxPreview.generatePreviewId(res.boxId!!);
        }),
        alphaNotificationCounter: withUser((args, uid) => uid),
        alphaChats: withAccount<{ first: number, after?: string | null, seq?: number }>(async (args, uid, oid) => {
            return await DB.tx(async (tx) => {
                let global = await DB.ConversationsUserGlobal.find({where: {userId: uid}, transaction: tx});
                let seq = global ? global.seq : 0;
                if (args.seq !== undefined && args.seq !== null && args.seq !== seq) {
                    throw new Error('Inconsistent request');
                }
                let conversations = await DB.ConversationUserState.findAll({
                    where: {
                        userId: uid,
                        ...args.after ? {
                            updatedAt: {
                                $lte: args.after
                            }
                        } : {},
                    },
                    order: [['updatedAt', 'DESC']],
                    limit: args.first + 1,
                    include: [{
                        model: DB.Conversation,
                        as: 'conversation'
                    }]
                });
                return {
                    conversations: conversations.map((v) => v.conversation!!).filter((c, i) => i < args.first),
                    seq: seq,
                    next: conversations.length > args.first ? conversations[args.first - 1].updatedAt : null,
                    counter: uid
                };
            });
        }),
        alphaChat: withAccount<{ conversationId: string }>((args, uid, oid) => {
            let id = IdsFactory.resolve(args.conversationId);
            if (id.type === IDs.Conversation) {
                return DB.Conversation.findById(id.id);
            } else if (id.type === IDs.User) {
                return Repos.Chats.loadPrivateChat(id.id, uid);
            } else if (id.type === IDs.Organization) {
                return Repos.Chats.loadOrganizationalChat(oid, id.id);
            } else {
                throw new IDMailformedError('Invalid id');
            }
        }),
        alphaLoadMessages: withUser<{ conversationId: string, first?: number, before?: string, after?: string }>((args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return DB.tx(async (tx) => {
                let conversation = (await DB.Conversation.findById(conversationId))!;

                if (conversation.type === 'group' || conversation.type === 'channel') {
                    let member = await DB.ConversationGroupMembers.find({
                        where: {
                            conversationId,
                            userId: uid,
                            status: 'member'
                        }
                    });
                    if (!member) {
                        throw new AccessDeniedError();
                    }
                }

                let beforeMessage: ConversationMessage | null = null;
                if (args.before) {
                    beforeMessage = await DB.ConversationMessage.findOne({where: {id: IDs.ConversationMessage.parse(args.before)}});
                }
                let afterMessage: ConversationMessage | null = null;
                if (args.after) {
                    afterMessage = await DB.ConversationMessage.findOne({where: {id: IDs.ConversationMessage.parse(args.after)}});
                }
                let seq = (conversation)!!.seq;
                return {
                    seq: seq,
                    messages: await (DB.ConversationMessage.findAll({
                        where: {
                            conversationId: conversationId,
                            ...((beforeMessage || afterMessage) ? {id: beforeMessage ? {$lt: beforeMessage.id} : {$gt: afterMessage!!.id}} : {}),
                        },
                        limit: args.first,
                        order: [['id', 'DESC']],
                        transaction: tx
                    }))
                };
            });
        }),
        alphaChatsSearchForCompose: withAccount<{ query: string, organizations: boolean }>(async (args, uid, oid) => {
            let orgs = args.organizations ? await DB.Organization.findAll({
                where: {
                    name: {
                        $ilike: args.query.toLowerCase() + '%'
                    },
                    id: {
                        $not: oid
                    },
                    status: 'ACTIVATED'
                },
                limit: 4
            }) : [];

            let user = await DB.UserProfile.find({where: {userId: uid}});
            let primaryOrganization = user ? user.primaryOrganization : undefined;
            let primaryOrgUsers: User[] = [];
            let membersUserIds: number[] = [];
            let sequelize = DB.connection;
            if (primaryOrganization) {
                let members = await DB.OrganizationMember.findAll({where: {orgId: primaryOrganization}});
                let membersIds = members.map(m => m.userId);
                let membersProfiles = await DB.UserProfile.findAll({
                    where:
                        [
                            sequelize.and(
                                {
                                    userId: {
                                        $in: membersIds
                                    }
                                },
                                {
                                    userId: {
                                        $not: uid
                                    }
                                },
                                sequelize.or(
                                    sequelize.where(sequelize.fn('concat', sequelize.col('firstName'), ' ', sequelize.col('lastName')), {
                                        $ilike: args.query.toLowerCase() + '%'
                                    }),
                                    {
                                        firstName: {
                                            $ilike: args.query.toLowerCase() + '%'
                                        }
                                    },
                                    {
                                        lastName: {
                                            $ilike: args.query.toLowerCase() + '%'
                                        }
                                    },
                                    {
                                        email: {
                                            $ilike: args.query.toLowerCase() + '%'
                                        }
                                    }
                                ),
                            )
                        ],
                    limit: 4
                });
                membersUserIds = membersProfiles.map(m => m.userId!!);
                primaryOrgUsers = await DB.User.findAll({
                    where: {
                        id: {
                            $in: membersUserIds
                        }
                    }
                });
            }

            let usersProfiles = await DB.UserProfile.findAll({
                where:
                    [
                        sequelize.and(
                            {
                                userId: {
                                    $notIn: [uid, ...membersUserIds]
                                }
                            },
                            sequelize.or(
                                sequelize.where(sequelize.fn('concat', sequelize.col('firstName'), ' ', sequelize.col('lastName')), {
                                    $ilike: args.query.toLowerCase() + '%'
                                }),
                                {
                                    firstName: {
                                        $ilike: args.query.toLowerCase() + '%'
                                    }
                                },
                                {
                                    lastName: {
                                        $ilike: args.query.toLowerCase() + '%'
                                    }
                                },
                                {
                                    email: {
                                        $ilike: args.query.toLowerCase() + '%'
                                    }
                                }
                            ),
                        )
                    ],
                limit: 4
            });
            let usersIds = usersProfiles.map(m => m.userId!!);
            let users = await DB.User.findAll({
                where: [
                    sequelize.and(
                        {
                            id: {
                                $in: usersIds
                            }
                        },
                        {
                            status: 'ACTIVATED'
                        }
                    )
                ],
                limit: 4
            });
            return [...orgs, ...primaryOrgUsers, ...users];
        }),
        alphaChatSearch: withAccount<{ members: string[] }>(async (args, uid, oid) => {
            let members = [...args.members.map((v) => IDs.User.parse(v)), uid];
            return await DB.txStable(async (tx) => {
                let groups = await DB.ConversationGroupMembers.findAll({
                    where: {
                        userId: uid
                    },
                    transaction: tx
                });
                let suitableGroups: number[] = [];
                for (let f of groups) {
                    let allMembers = await DB.ConversationGroupMembers.findAll({
                        where: {
                            conversationId: f.conversationId
                        },
                        transaction: tx
                    });
                    if (allMembers.length !== members.length) {
                        continue;
                    }

                    let missed = members
                        .map((v) => !!allMembers.find((v2) => v2.userId === v))
                        .filter((v) => !v);
                    if (missed.length > 0) {
                        continue;
                    }
                    suitableGroups.push(f.conversationId);
                }
                if (suitableGroups.length === 0) {
                    return null;
                }
                return await DB.Conversation.find({
                    where: {
                        id: {
                            $in: suitableGroups
                        }
                    },
                    order: [['updatedAt', 'DESC']],
                    transaction: tx
                });
            });
        }),
        alphaChatTextSearch: withAccount<{ query: string }>(async (args, uid, oid) => {

            // GROUPS / CHANNELS has titles we can search 
            let searchableConversations = (await DB.ConversationUserState.findAll({where: {userId: uid}})).map(s => s.conversationId);
            let sequelize = DB.connection;
            let groupsChannels = await DB.Conversation.findAll({
                where: {
                    type: {
                        $in: ['group', 'channel']
                    },
                    title: {
                        $ilike: args.query.toLowerCase() + '%'
                    },
                    id: {
                        $in: searchableConversations
                    }
                }
            });

            // PERSONAL - search users first, then matching conversations with current user
            let usersProfiles = await DB.UserProfile.findAll({
                where:
                    [
                        sequelize.and(
                            {
                                userId: {
                                    $not: uid
                                }
                            },
                            sequelize.or(
                                sequelize.where(sequelize.fn('concat', sequelize.col('firstName'), ' ', sequelize.col('lastName')), {
                                    $ilike: args.query.toLowerCase() + '%'
                                }),
                                {
                                    firstName: {
                                        $ilike: args.query.toLowerCase() + '%'
                                    }
                                },
                                {
                                    lastName: {
                                        $ilike: args.query.toLowerCase() + '%'
                                    }
                                },
                                {
                                    email: {
                                        $ilike: args.query.toLowerCase() + '%'
                                    }
                                }
                            ),
                        )
                    ],
            });
            let userIds = usersProfiles.map(u => u.userId!!);

            let personal = await DB.Conversation.findAll({
                where: [
                    sequelize.and(
                        {
                            type: 'private'
                        },
                        sequelize.or(
                            {
                                member1Id: uid,
                                member2Id: {
                                    $in: userIds
                                }
                            },
                            {
                                member2Id: uid,
                                member1Id: {
                                    $in: userIds
                                }
                            }
                        )
                    )
                ]
            });

            // SHARED search org1 matching name, org2 current and vice versa
            let orgs1 = await DB.Conversation.findAll({
                include: [
                    {
                        model: DB.Organization,
                        as: 'organization1',
                        required: true,
                        where: {
                            name: {
                                $ilike: args.query.toLowerCase() + '%'
                            }
                        }
                    },
                    {
                        model: DB.Organization,
                        as: 'organization2',
                        required: true,
                        where: {
                            id: oid
                        }
                    }
                ]
            });
            let orgs2 = await DB.Conversation.findAll({
                include: [
                    {
                        model: DB.Organization,
                        as: 'organization2',
                        required: true,
                        where: {
                            name: {
                                $ilike: args.query.toLowerCase() + '%'
                            }
                        }
                    },
                    {
                        model: DB.Organization,
                        as: 'organization1',
                        required: true,
                        where: {
                            id: oid
                        }
                    }
                ]
            });
            // ORG INNER CHATS
            let userAsMember = await DB.OrganizationMember.findAll({
                where: {
                    userId: uid
                }
            });
            let orgsIds = userAsMember.map(m => m.orgId);
            let orgsInner = await DB.Conversation.findAll({
                include: [
                    {
                        model: DB.Organization,
                        as: 'organization1',
                        required: true,
                        where: {
                            id: {
                                $in: orgsIds,
                            },
                            name: {
                                $ilike: args.query.toLowerCase() + '%'
                            }
                        }
                    },
                    {
                        model: DB.Organization,
                        as: 'organization2',
                        required: true,
                        where: {
                            id: {
                                $in: orgsIds,
                            },
                            name: {
                                $ilike: args.query.toLowerCase() + '%'
                            }
                        }
                    },
                ]
            });

            let res = [...personal, ...groupsChannels, ...orgs1, ...orgs2, ...orgsInner];
            res = res.reduce(
                (p, x) => {
                    if (!p.find(c => c.id === x.id)) {
                        p.push(x);
                    }
                    return p;
                },
                [] as any[]
            );
            return res;

        }),
        alphaGroupConversationMembers: withAccount<{ conversationId: string }>(async (args, uid, oid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);

            let members = await DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId
                }
            });

            return members;
        }),
        alphaBlockedList: withAccount<{ conversationId?: string }>(async (args, uid, oid) => {
            let conversationId = args.conversationId ? IDs.Conversation.parse(args.conversationId) : null;

            return await DB.ConversationBlocked.findAll({
                where: {
                    conversation: conversationId,
                    ...(conversationId ? {} : {blockedBy: uid})
                }
            });
        }),
    },
    Mutation: {
        superCreateChat: withPermission<{ title: string }>('software-developer', async (args) => {
            await validate({title: stringNotEmpty()}, args);
            return DB.Conversation.create({
                title: args.title
            });
        }),
        alphaReadChat: withAccount<{ conversationId: string, messageId: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            await DB.txStable(async (tx) => {
                let msg = await DB.ConversationMessage.find({
                    where: {
                        id: messageId,
                        conversationId: conversationId
                    },
                    transaction: tx
                });
                if (!msg) {
                    throw Error('Invalid request');
                }
                let existing = await DB.ConversationUserState.find({
                    where: {
                        userId: uid,
                        conversationId: conversationId
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
                let existingGlobal = await DB.ConversationsUserGlobal.find({
                    where: {
                        userId: uid
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
                let delta = 0;
                let totalUnread = 0;
                if (existing) {
                    if (existing.readDate < messageId) {
                        let remaining = await DB.ConversationMessage.count({
                            where: {
                                conversationId,
                                id: {
                                    $gt: messageId
                                },
                                userId: {
                                    $not: uid
                                }
                            },
                            transaction: tx
                        });
                        if (!existingGlobal) {
                            throw Error('Internal inconsistency');
                        }
                        if (remaining === 0) {
                            delta = -existing.unread;
                            existing.unread = 0;
                            existing.readDate = messageId;
                        } else {
                            delta = remaining - existing.unread;
                            existing.unread = remaining;
                            existing.readDate = messageId;
                            totalUnread = remaining;
                        }
                        await existing.save({transaction: tx});
                    }
                } else {
                    let remaining = await DB.ConversationMessage.count({
                        where: {
                            conversationId,
                            id: {
                                $gt: messageId
                            },
                            userId: {
                                $not: uid
                            }
                        },
                        transaction: tx
                    });
                    if (remaining > 0) {
                        await DB.ConversationUserState.create({
                            userId: uid,
                            conversationId: conversationId,
                            readDate: messageId,
                            unread: remaining
                        }, {transaction: tx});
                        delta = remaining;
                        if (!existingGlobal) {
                            throw Error('Internal inconsistency');
                        }
                    }
                }
                if (existingGlobal && delta !== 0) {

                    //
                    // Update Global State
                    //

                    let unread = existingGlobal.unread + delta;
                    if (unread < 0) {
                        throw Error('Internal inconsistency');
                    }
                    existingGlobal.unread = unread;
                    existingGlobal.seq++;
                    existingGlobal.hasUnnoticedUnread = false;
                    await existingGlobal.save({transaction: tx});

                    //
                    // Write Event
                    //

                    await DB.ConversationUserEvents.create({
                        seq: existingGlobal.seq,
                        userId: uid,
                        eventType: 'conversation_read',
                        event: {
                            conversationId: conversationId,
                            unread: totalUnread,
                            unreadGlobal: existingGlobal.unread
                        }
                    }, {transaction: tx});
                }
            });
            return {
                uid: uid,
                conversationId: conversationId
            };
        }),
        alphaGlobalRead: withAccount<{ toSeq: number }>(async (args, uid) => {
            await DB.txStable(async (tx) => {
                let global = await DB.ConversationsUserGlobal.find({
                    where: {
                        userId: uid
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
                if (global && (global.readSeq === null || global.readSeq < args.toSeq) && args.toSeq <= global.seq) {
                    global.readSeq = args.toSeq;
                    await global.save({transaction: tx});
                }
            });
            return 'ok';
        }),
        alphaSendMessage: withAccount<{ conversationId: string, message?: string | null, file?: string | null, repeatKey?: string | null }>(async (args, uid) => {
            // validate({ message: stringNotEmpty() }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);

            let fileMetadata: JsonMap | null;
            let filePreview: string | null;

            if (args.file) {
                let fileInfo = await Services.UploadCare.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Services.UploadCare.fetchLowResPreview(args.file);
                }
            }

            return await DB.txStable(async (tx) => {
                return (await Repos.Chats.sendMessage(tx, conversationId, uid!, {
                    message: args.message,
                    file: args.file,
                    fileMetadata,
                    repeatKey: args.repeatKey,
                    filePreview
                })).conversationEvent;
            });
        }),
        alphaEditMessage: withAccount<{ messageId: string, message?: string | null, file?: string | null }>(async (args, uid) => {
            let fileMetadata: JsonMap | null;
            let filePreview: string | null;

            if (args.file) {
                let fileInfo = await Services.UploadCare.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Services.UploadCare.fetchLowResPreview(args.file);
                }
            }

            let messageId = IDs.ConversationMessage.parse(args.messageId);

            return await DB.txStable(async (tx) => {
                return await Repos.Chats.editMessage(
                    tx,
                    messageId,
                    uid,
                    {
                        message: args.message,
                        file: args.file,
                        fileMetadata,
                        filePreview
                    },
                    true
                );
            });
        }),
        alphaDeleteMessage: withAccount<{ messageId: string }>(async (args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);

            return await DB.txStable(async (tx) => {
                return await Repos.Chats.deleteMessage(tx, messageId, uid);
            });
        }),
        alphaSetTyping: withAccount<{ conversationId: string, type: string }>(async (args, uid) => {

            await validate({type: optional(enumString(['text', 'photo']))}, args);

            let conversationId = IDs.Conversation.parse(args.conversationId);

            await Repos.Chats.typingManager.setTyping(uid, conversationId, args.type || 'text');

            return 'ok';
        }),

        alphaChatCreateGroup: withAccount<{ title?: string | null, message: string, members: string[] }>(async (args, uid, oid) => {
            return await DB.txStable(async (tx) => {
                let title = args.title ? args.title!! : '';
                let conv = await DB.Conversation.create({
                    title: title,
                    type: 'group'
                }, {transaction: tx});
                let members = [uid, ...args.members.map((v) => IDs.User.parse(v))];
                for (let m of members) {
                    await DB.ConversationGroupMembers.create({
                        conversationId: conv.id,
                        invitedById: uid,
                        userId: m,
                        role: m === uid ? 'creator' : 'member'
                    }, {transaction: tx});
                }

                await Repos.Chats.sendMessage(tx, conv.id, uid, {message: args.message});
                return conv;
            });
        }),
        alphaChatUpdateGroup: withAccount<{ conversationId: string, input: { title?: string | null, description?: string | null, longDescription?: string | null, photoRef?: ImageRef | null, socialImageRef?: ImageRef | null } }>(async (args, uid, oid) => {
            await validate(
                {
                    title: optional(stringNotEmpty('Title can\'t be empty!'))
                },
                args.input
            );

            let conversationId = IDs.Conversation.parse(args.conversationId);

            return await DB.txStable(async (tx) => {
                let chat = await DB.Conversation.findById(conversationId, {transaction: tx});

                if (!chat) {
                    throw new Error('Chat not found');
                }

                let chatChanged = false;

                if (args.input.title !== undefined && args.input.title !== chat.title) {
                    chatChanged = true;
                    chat.title = args.input.title!.trim();

                    await Repos.Chats.sendMessage(tx, conversationId, uid, {
                        message: `New chat title: ${args.input.title}`,
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'title_change',
                            title: args.input.title
                        }
                    });
                }

                let imageRef = Sanitizer.sanitizeImageRef(args.input.photoRef);

                if (args.input.photoRef !== undefined && !imageRefEquals(chat.extras.picture as any || null, imageRef)) {
                    chatChanged = true;
                    if (args.input.photoRef !== null) {
                        await Services.UploadCare.saveFile(args.input.photoRef.uuid);
                    }
                    (chat as any).changed('extras', true);
                    chat.extras.picture = imageRef as any;

                    await Repos.Chats.sendMessage(tx, conversationId, uid, {
                        message: `New chat photo`,
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'photo_change',
                            picture: imageRef as any
                        }
                    });
                }

                if (args.input.description !== undefined) {
                    chatChanged = true;
                    chat.extras.description = Sanitizer.sanitizeString(args.input.description);
                }
                if (args.input.longDescription !== undefined) {
                    chatChanged = true;
                    chat.extras.longDescription = Sanitizer.sanitizeString(args.input.longDescription);
                }

                let socialImageRef = Sanitizer.sanitizeImageRef(args.input.socialImageRef);
                if (args.input.socialImageRef !== undefined && !imageRefEquals(chat.extras.socialImage as any || null, socialImageRef)) {
                    chatChanged = true;
                    if (args.input.socialImageRef !== null) {
                        await Services.UploadCare.saveFile(args.input.socialImageRef.uuid);
                    }
                    chat.extras.socialImage = socialImageRef as any;
                }

                if (chatChanged) {
                    await Repos.Chats.addChatEvent(
                        conversationId,
                        'chat_update',
                        {},
                        tx
                    );

                    await Repos.Chats.addUserEventsInConversation(
                        conversationId,
                        uid,
                        'chat_update',
                        {
                            conversationId
                        },
                        tx
                    );

                    await chat.save({transaction: tx});
                }

                await chat.reload({transaction: tx});

                return {
                    chat,
                    curSeq: chat.seq
                };
            });
        }),
        alphaChatChangeGroupTitle: withAccount<{ conversationId: string, title: string }>(async (args, uid) => {
            return DB.tx(async (tx) => {
                await validate({title: defined(stringNotEmpty())}, args);

                let conversationId = IDs.Conversation.parse(args.conversationId);

                let chat = await DB.Conversation.findById(conversationId, {transaction: tx});

                if (!chat || chat.type !== 'group') {
                    throw new Error('Chat not found');
                }

                await chat.update({
                    title: args.title
                }, {transaction: tx});

                let titleChatEvent = await Repos.Chats.addChatEvent(
                    conversationId,
                    'title_change',
                    {
                        title: args.title
                    },
                    tx
                );

                let titleUserEvent = await Repos.Chats.addUserEventsInConversation(
                    conversationId,
                    uid,
                    'title_change',
                    {
                        title: args.title
                    },
                    tx
                );

                let {
                    conversationEvent,
                    userEvent
                } = await Repos.Chats.sendMessage(tx, conversationId, uid, {
                    message: `New chat title: ${args.title}`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'title_change',
                        title: args.title
                    }
                });

                return {
                    chat,
                    chatEventMessage: conversationEvent,
                    userEventMessage: userEvent,
                    chatEvent: titleChatEvent,
                    userEvent: titleUserEvent
                };
            });
        }),
        alphaChatInviteToGroup: withAccount<{ conversationId: string, invites: { userId: string, role: string }[] }>(async (args, uid) => {
            return DB.tx(async (tx) => {
                await validate({
                    invites: mustBeArray({
                        userId: defined(stringNotEmpty()),
                        role: defined(enumString(['member', 'admin']))
                    })
                }, args);

                let conversationId = IDs.Conversation.parse(args.conversationId);

                let chat = await DB.Conversation.findById(conversationId, {transaction: tx});

                if (!chat || chat.type !== 'group') {
                    throw new Error('Chat not found');
                }

                let curMember = await DB.ConversationGroupMembers.findOne({
                    where: {
                        conversationId,
                        userId: uid
                    }
                });

                if (!curMember) {
                    throw new AccessDeniedError();
                }

                for (let invite of args.invites) {
                    let userId = IDs.User.parse(invite.userId);

                    let blocked = await DB.ConversationBlocked.findOne({
                        where: {
                            user: userId,
                            conversation: conversationId
                        }
                    });

                    if (blocked && !(curMember!.role === 'admin' || curMember!.role === 'creator')) {
                        throw new Error('Can\'t invite blocked user');
                    }

                    try {
                        await DB.ConversationGroupMembers.create({
                            conversationId: conversationId,
                            invitedById: uid,
                            userId: userId,
                            role: invite.role
                        }, {transaction: tx});
                    } catch (e) {
                        throw new Error('User already invited');
                    }
                }

                let users: UserProfile[] = [];

                for (let invite of args.invites) {
                    users.push((await DB.UserProfile.findById(invite.userId))!);
                }

                let {
                    conversationEvent,
                    userEvent
                } = await Repos.Chats.sendMessage(
                    tx,
                    conversationId,
                    uid,
                    {
                        message: `Users <${users.map(u => u.firstName).join(', ')}> joined chat`,
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'user_invite',
                            userIds: args.invites.map(i => IDs.User.parse(i.userId)),
                            invitedById: uid
                        }
                    }
                );

                let chatEvent = await Repos.Chats.addChatEvent(
                    conversationId,
                    'new_members',
                    {
                        userIds: args.invites.map(i => IDs.User.parse(i.userId)),
                        invitedById: uid
                    },
                    tx
                );

                let membersCount = await Repos.Chats.membersCountInConversation(conversationId);

                let inviteUserEvent = await Repos.Chats.addUserEventsInConversation(
                    conversationId,
                    uid,
                    'new_members_count',
                    {
                        conversationId,
                        membersCount: membersCount + args.invites.length
                    },
                    tx
                );

                return {
                    chat,
                    chatEventMessage: conversationEvent,
                    userEventMessage: userEvent,
                    chatEvent,
                    userEvent: inviteUserEvent
                };
            });
        }),
        alphaChatKickFromGroup: withAccount<{ conversationId: string, userId: string }>(async (args, uid) => {
            return DB.tx(async (tx) => {
                let conversationId = IDs.Conversation.parse(args.conversationId);
                let userId = IDs.User.parse(args.userId);

                let chat = await DB.Conversation.findById(conversationId, {transaction: tx});

                if (!chat || (chat.type !== 'group' && chat.type !== 'channel')) {
                    throw new Error('Chat not found');
                }

                let member = await DB.ConversationGroupMembers.findOne({
                    where: {
                        conversationId,
                        userId
                    }
                });

                if (!member) {
                    throw new Error('No such member');
                }

                let curMember = await DB.ConversationGroupMembers.findOne({
                    where: {
                        conversationId,
                        userId: uid
                    }
                });

                if (!curMember) {
                    throw new AccessDeniedError();
                }

                let canKick = curMember.role === 'admin' || curMember.role === 'creator' || member.invitedById === uid;

                if (!canKick) {
                    throw new AccessDeniedError();
                }

                await DB.ConversationGroupMembers.destroy({
                    where: {
                        conversationId,
                        userId
                    }
                });

                await Repos.Chats.blockUser(tx, userId, uid, conversationId);

                let profile = await DB.UserProfile.findById(userId);

                let {
                    conversationEvent,
                    userEvent
                } = await Repos.Chats.sendMessage(
                    tx,
                    conversationId,
                    uid,
                    {
                        message: `${profile!.firstName} was kicked from chat`,
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'user_kick',
                            userId,
                            kickedById: uid
                        }
                    }
                );

                let chatEvent = await Repos.Chats.addChatEvent(
                    conversationId,
                    'kick_member',
                    {
                        userId: userId,
                        kickedBy: uid
                    },
                    tx
                );

                let membersCount = await Repos.Chats.membersCountInConversation(conversationId);

                let inviteUserEvent = await Repos.Chats.addUserEventsInConversation(
                    conversationId,
                    uid,
                    'new_members_count',
                    {
                        conversationId,
                        membersCount: membersCount
                    },
                    tx
                );

                return {
                    chat,
                    chatEventMessage: conversationEvent,
                    userEventMessage: userEvent,
                    chatEvent,
                    userEvent: inviteUserEvent
                };
            });
        }),
        alphaChatChangeRoleInGroup: withAccount<{ conversationId: string, userId: string, newRole: string }>(async (args, uid) => {
            return DB.tx(async (tx) => {
                await validate({
                    newRole: defined(enumString(['member', 'admin']))
                }, args);

                let conversationId = IDs.Conversation.parse(args.conversationId);
                let userId = IDs.User.parse(args.userId);

                let chat = await DB.Conversation.findById(conversationId, {transaction: tx});

                if (!chat || chat.type !== 'group') {
                    throw new Error('Chat not found');
                }

                let member = await DB.ConversationGroupMembers.findOne({
                    where: {
                        conversationId,
                        userId
                    },
                    transaction: tx
                });

                if (!member) {
                    throw new Error('Member not found');
                }

                let curMember = await DB.ConversationGroupMembers.findOne({
                    where: {
                        conversationId,
                        userId: uid
                    }
                });

                if (!curMember) {
                    throw new AccessDeniedError();
                }

                let canChangeRole = curMember.role === 'admin' || curMember.role === 'creator';

                if (!canChangeRole) {
                    throw new AccessDeniedError();
                }

                await member.update({role: args.newRole}, {transaction: tx});

                let chatEvent = await Repos.Chats.addChatEvent(
                    conversationId,
                    'update_role',
                    {
                        userId: userId,
                        newRole: args.newRole
                    },
                    tx
                );

                return {
                    chat,
                    chatEvent,
                };
            });
        }),
        alphaChatCopyGroup: withAccount<{ conversationId: string, extraMembers: string[], title?: string, message: string }>(async (args, uid) => {
            return DB.tx(async (tx) => {
                let conversationId = IDs.Conversation.parse(args.conversationId);
                let chat = await DB.Conversation.findById(conversationId, {transaction: tx});

                if (!chat || chat.type !== 'group') {
                    throw new Error('Chat not found');
                }

                let title = args.title ? args.title! : chat.title;
                let conv = await DB.Conversation.create({
                    title,
                    type: 'group'
                }, {transaction: tx});

                let members = Array.from(new Set([
                    ...await Repos.Chats.getConversationMembers(conversationId),
                    ...args.extraMembers.map(id => IDs.User.parse(id))
                ]));

                for (let member of members) {
                    await DB.ConversationGroupMembers.create({
                        conversationId: conv.id,
                        invitedById: uid,
                        userId: member,
                        role: member === uid ? 'creator' : 'member'
                    }, {transaction: tx});
                }
                let {
                    conversationEvent,
                    userEvent
                } = await Repos.Chats.sendMessage(tx, conv.id, uid, {message: args.message});

                return {
                    chat,
                    chatEventMessage: conversationEvent,
                    userEventMessage: userEvent,
                };
            });
        }),

        alphaBlockUser: withAccount<{ userId: string }>(async (args, uid) => {
            return DB.tx(async (tx) => {
                await Repos.Chats.blockUser(tx, IDs.User.parse(args.userId), uid);
                return 'ok';
            });
        }),
        alphaUnblockUser: withAccount<{ userId: string, conversationId?: string }>(async (args, uid) => {
            let conversationId = args.conversationId ? IDs.Conversation.parse(args.conversationId) : null;
            let blocked = await DB.ConversationBlocked.findOne({
                where: {
                    user: IDs.User.parse(args.userId),
                    conversation: conversationId,
                    ...(conversationId ? {} : {blockedBy: uid})
                }
            });
            if (blocked) {
                await blocked.destroy();
            }
            return 'ok';
        }),
        alphaUpdateConversationSettings: withUser<{ settings: { mobileNotifications?: string | null, mute?: boolean | null }, conversationId: string }>(async (args, uid) => {
            return await DB.tx(async (tx) => {
                let cid = IDs.Conversation.parse(args.conversationId);
                let conversationUserState = (await DB.ConversationUserState.find({
                    where: {
                        userId: uid,
                        conversationId: cid
                    }, transaction: tx, lock: 'UPDATE'
                }))!!;

                if (args.settings.mobileNotifications) {
                    conversationUserState.notificationsSettings = {
                        ...conversationUserState.notificationsSettings,
                        mobileNotifications: args.settings.mobileNotifications
                    };
                }
                if (args.settings.mute !== undefined) {
                    conversationUserState.notificationsSettings = {
                        ...conversationUserState.notificationsSettings,
                        mute: args.settings.mute
                    };
                }
                await conversationUserState.save({transaction: tx});
                return {
                    ...conversationUserState.notificationsSettings,
                    id: IDs.ConversationSettings.serialize(cid)
                };
            });
        })
    },
    Subscription: {
        alphaChatSubscribe: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { conversationId: string, fromSeq?: number }, context: CallContext) {
                let conversationId = IDs.Conversation.parse(args.conversationId);
                if (!context.uid) {
                    throw Error('Not logged in');
                }
                let conversation = (await DB.Conversation.findById(conversationId))!;
                if (conversation.type === 'group' || conversation.type === 'channel') {
                    let member = await DB.ConversationGroupMembers.find({
                        where: {
                            userId: context.uid,
                            status: 'member'
                        }
                    });
                    if (!member) {
                        throw new AccessDeniedError();
                    }
                }

                let ended = false;
                return {
                    ...async function* func() {
                        let lastKnownSeq = args.fromSeq;
                        while (!ended) {
                            if (lastKnownSeq !== undefined) {
                                let events = await DB.ConversationEvent.findAll({
                                    where: {
                                        conversationId: conversationId,
                                        seq: {
                                            $gt: lastKnownSeq
                                        }
                                    },
                                    order: ['seq']
                                });
                                for (let r of events) {
                                    yield r;
                                }
                                if (events.length > 0) {
                                    lastKnownSeq = events[events.length - 1].seq;
                                }
                            }
                            let res = await new Promise<number>((resolve) => Repos.Chats.reader.loadNext(conversationId, lastKnownSeq ? lastKnownSeq : null, (arg) => resolve(arg)));
                            if (!lastKnownSeq) {
                                lastKnownSeq = res - 1;
                            }
                        }
                    }(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        },
        alphaNotificationCounterSubscribe: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: any, context: CallContext) {
                if (!context.uid) {
                    throw Error('Not logged in');
                }
                let ended = false;
                return {
                    ...async function* func() {
                        let state = await DB.ConversationsUserGlobal.find({where: {userId: context.uid!!}});
                        if (state) {
                            yield {
                                counter: state.unread,
                                uid: context.uid
                            };
                        }
                        while (!ended) {
                            let counter = await Repos.Chats.counterReader.loadNext(context.uid!!);
                            yield {
                                counter,
                                uid: context.uid
                            };
                        }
                    }(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        },
        alphaSubscribeEvents: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { fromSeq?: number }, context: CallContext) {
                let ended = false;
                return {
                    ...(async function* func() {
                        let lastKnownSeq = args.fromSeq;
                        while (!ended) {
                            if (lastKnownSeq !== undefined) {
                                let events = await DB.ConversationUserEvents.findAll({
                                    where: {
                                        userId: context.uid,
                                        seq: {
                                            $gt: lastKnownSeq
                                        }
                                    },
                                    order: [['seq', 'asc']]
                                });
                                for (let r of events) {
                                    yield r;
                                }
                                if (events.length > 0) {
                                    lastKnownSeq = events[events.length - 1].seq;
                                }
                            }
                            let res = await Repos.Chats.userReader.loadNext(context.uid!!, lastKnownSeq ? lastKnownSeq : null);
                            if (!lastKnownSeq) {
                                lastKnownSeq = res - 1;
                            }
                        }
                    })(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        },
        alphaSubscribeTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: any, context: CallContext) {
                if (!context.uid) {
                    throw Error('Not logged in');
                }

                return Repos.Chats.typingManager.getXIterator(context.uid);
            }
        },
        alphaSubscribeChatTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { conversationId: string }, context: CallContext) {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                if (!context.uid) {
                    throw Error('Not logged in');
                }

                return Repos.Chats.typingManager.getXIterator(context.uid, conversationId);
            }
        }
    }
};