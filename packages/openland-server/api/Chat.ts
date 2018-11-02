import { IDs, IdsFactory } from './utils/IDs';
import { Conversation } from '../tables/Conversation';
import { DB, User } from '../tables';
import { withPermission, withUser, resolveUser, withAccount } from './utils/Resolvers';
import {
    validate,
    stringNotEmpty,
    enumString,
    optional,
    defined,
    mustBeArray,
    isNumber
} from '../modules/NewInputValidator';
import { CallContext } from './utils/CallContext';
import { Repos } from '../repositories';
import { JsonMap } from '../utils/json';
import { IDMailformedError } from '../errors/IDMailformedError';
import { ImageRef, buildBaseImageUrl, imageRefEquals } from '../repositories/Media';
import { Organization } from '../tables/Organization';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { Services } from '../services';
import { UserError } from '../errors/UserError';
import { NotFoundError } from '../errors/NotFoundError';
import { Sanitizer } from '../modules/Sanitizer';
import { URLAugmentation } from '../services/UrlInfoService';
import { Modules } from 'openland-modules/Modules';
import { OnlineEvent } from '../../openland-module-presences/PresenceModule';
import { UserProfile, UserDialogSettings, Message, RoomParticipant } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { TypingEvent } from 'openland-module-typings/TypingEvent';
import { withLogContext } from 'openland-log/withLogContext';
import { FDB } from 'openland-module-db/FDB';

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
            let state = await FDB.UserDialog.findById(context.uid!!, src.id);
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => Modules.Messaging.repo.findTopMessage(src.id!),
        settings: (src: Conversation, _: any, context: CallContext) => Modules.Messaging.getConversationSettings(context.uid!!, src.id),
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
            let state = await FDB.UserDialog.findById(context.uid!!, src.id);
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => Modules.Messaging.repo.findTopMessage(src.id!),
        organization: async (src: Conversation, _: any, context: CallContext) => {
            if (src.organization1Id === context.oid || (src.organization1 && src.organization1.id === context.oid)) {
                return (src.organization2 || await src.getOrganization2())!!;
            } else if (src.organization2Id === context.oid || (src.organization2 && src.organization2.id === context.oid)) {
                return (src.organization1 || await src.getOrganization1())!!;
            }
            return src.organization1 || await src.getOrganization1();
        },
        settings: (src: Conversation, _: any, context: CallContext) => Modules.Messaging.getConversationSettings(context.uid!!, src.id),
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
            let profile = (await Modules.Users.profileById(uid))!;
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
            let profile = (await Modules.Users.profileById(uid))!;

            if (profile.picture) {
                return [buildBaseImageUrl(profile.picture)];
            } else {
                return [];
            }
        },
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await FDB.UserDialog.findById(context.uid!!, src.id);
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => Modules.Messaging.repo.findTopMessage(src.id!),
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
        blocked: async (src: Conversation, _: any, context: CallContext) => false,
        settings: (src: Conversation, _: any, context: CallContext) => Modules.Messaging.getConversationSettings(context.uid!!, src.id),
    },
    GroupConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: async (src: Conversation, _: any, context: CallContext) => {
            if (src.title !== '') {
                return src.title;
            }
            let res = (await FDB.RoomParticipant.allFromActive(src.id)).filter((v) => v.uid !== context.uid);
            let name: string[] = [];
            for (let r of res) {
                let p = (await Modules.Users.profileById(r.uid))!;
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
            let res = await FDB.RoomParticipant.allFromActive(src.id);
            return res.map((v) => DB.User.findById(v.uid));
        },
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await FDB.UserDialog.findById(context.uid!!, src.id);
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: async (src: Conversation, _: any, context: CallContext) => {
            if (!await Modules.Messaging.room.isActiveMember(context.uid!, src.id)) {
                return null;
            }

            return Modules.Messaging.repo.findTopMessage(src.id!);
        },
        membersCount: (src: Conversation) => Repos.Chats.membersCountInConversation(src.id),
        settings: (src: Conversation, _: any, context: CallContext) => Modules.Messaging.getConversationSettings(context.uid!!, src.id),

        photo: (src: Conversation) => src.extras && src.extras.picture ? buildBaseImageUrl(src.extras.picture as any) : null,
        photoRef: (src: Conversation) => src.extras && src.extras.picture,
        description: (src: Conversation) => src.extras.description || '',
        longDescription: (src: Conversation) => src.extras.longDescription || '',
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
        myRole: async (src: Conversation, _: any, ctx: CallContext) => {
            let member = await Modules.Messaging.room.findMembershipStatus(ctx.uid!, src.id);

            return member && member.role;
        }
    },

    MessageReaction: {
        user: (src: any) => DB.User.findById(src.userId),
        reaction: (src: any) => src.reaction
    },
    UrlAugmentationExtra: {
        __resolveType(src: any) {
            if (src instanceof (DB.User as any)) {
                return 'User';
            } else if (src instanceof (DB.Organization as any)) {
                return 'Organization';
            } else if (src instanceof (DB.Conversation as any)) {
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
                return DB.User.findById(src.extra);
            } else if (src.type === 'org') {
                return DB.Organization.findById(src.extra);
            } else if (src.type === 'channel') {
                return DB.Conversation.findById(src.extra);
            } else if (src.type === 'intro') {
                return DB.User.findById(src.extra);
            }

            return null;
        },

    },
    ConversationMessage: {
        id: (src: Message) => {
            return IDs.ConversationMessage.serialize(src.id);
        },
        message: (src: Message) => src.text,
        file: (src: Message) => src.fileId,
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
        sender: (src: Message, _: any, context: CallContext) => Repos.Users.userLoader(context).load(src.uid),
        date: (src: Message) => src.createdAt,
        repeatKey: (src: Message, args: any, context: CallContext) => src.uid === context.uid ? src.repeatKey : null,
        isService: (src: Message) => src.isService,
        serviceMetadata: (src: Message) => {
            if (src.serviceMetadata && (src.serviceMetadata as any).type) {
                return src.serviceMetadata;
            }

            return null;
        },
        urlAugmentation: (src: Message) => src.augmentation,
        edited: (src: Message) => (src.edited) || false,
        reactions: (src: Message) => src.reactions || [],
        replyMessages: async (src: Message) => {
            return src.replyMessages ? (src.replyMessages as number[]).map(id => FDB.Message.findById(id)) : null;
        },
        plainText: async (src: Message) => null,
        mentions: async (src: Message) => src.mentions ? (src.mentions as number[]).map(id => DB.User.findById(id)) : null
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
    ChatReadResult: {
        conversation: (src: { uid: number, conversationId: number }) => DB.Conversation.findById(src.conversationId),
        counter: (src: { uid: number, conversationId: number }) => src.uid
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

    TypingEvent: {
        type: (src: TypingEvent) => src.type,
        cancel: (src: TypingEvent) => src.cancel,
        conversation: (src: TypingEvent) => DB.Conversation.findById(src.conversationId),
        user: (src: TypingEvent) => DB.User.findById(src.userId),
    },
    OnlineEvent: {
        type: (src: OnlineEvent) => src.online ? 'online' : 'offline',
        user: (src: OnlineEvent) => DB.User.findById(src.userId),
        timeout: (src: OnlineEvent) => src.timeout,
    },

    GroupConversationMember: {
        role: (src: RoomParticipant) => src.role === 'owner' ? 'creator' : src.role,
        user: (src: RoomParticipant) => DB.User.findById(src.uid)
    },

    ConversationSettings: {
        id: (src: UserDialogSettings) => IDs.ConversationSettings.serialize(src.cid),
        mute: (src: UserDialogSettings) => src.mute,
        mobileNotifications: (src: UserDialogSettings) => 'all'
    },

    Query: {
        alphaNotificationCounter: withUser((args, uid) => uid),
        alphaChat: withAccount<{ conversationId?: string, shortName?: string }>(async (args, uid, oid) => {
            if (args.shortName) {
                let shortName = await Modules.Shortnames.findShortname(args.shortName);
                if (!shortName) {
                    throw new NotFoundError();
                }

                if (shortName.ownerType === 'user') {
                    return Repos.Chats.loadPrivateChat(shortName.ownerId!, uid);
                } else if (shortName.ownerType === 'org') {
                    return Repos.Chats.loadOrganizationalChat(oid, shortName.ownerId!);
                } else {
                    throw new NotFoundError();
                }
            } else if (args.conversationId) {
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
            } else {
                throw new UserError('No id passed');
            }
        }),
        alphaLoadMessages: withUser<{ conversationId: string, first?: number, before?: string, after?: string }>((args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return DB.tx(async (tx) => {
                let conversation = (await DB.Conversation.findById(conversationId))!;

                if (conversation.type === 'group' || conversation.type === 'channel') {
                    if (!await Modules.Messaging.room.isActiveMember(uid, conversationId)) {
                        throw new AccessDeniedError();
                    }
                }

                let beforeMessage: Message | null = null;
                if (args.before) {
                    beforeMessage = await FDB.Message.findById(IDs.ConversationMessage.parse(args.before));
                }
                // let afterMessage: Message | null = null;
                // if (args.after) {
                //     afterMessage = await FDB.Message.findById(IDs.ConversationMessage.parse(args.after));
                // }
                let seq = (conversation)!!.seq;

                if (beforeMessage) {
                    return {
                        seq: seq,
                        messages: await FDB.Message.rangeFromChatAfter(conversationId, beforeMessage.id, args.first!, true)
                    };
                }

                return {
                    seq: seq,
                    messages: await FDB.Message.rangeFromChat(conversationId, args.first!, true)
                };
                // if (beforeMessage) {
                //     return {
                //         seq: seq,
                //         messages: await FDB.Message.rangeFromChat(conversationId, args.first!, true)
                //     };
                // } else if (afterMessage) {

                // }
                // return {
                //     seq: seq,
                //     messages: await (DB.ConversationMessage.findAll({
                //         where: {
                //             conversationId: conversationId,
                //             ...((beforeMessage || afterMessage) ? { id: beforeMessage ? { $lt: beforeMessage.id } : { $gt: afterMessage!!.id } } : {}),
                //         },
                //         limit: args.first,
                //         order: [['id', 'DESC']],
                //         transaction: tx
                //     }))
                // };
            });
        }),
        alphaChatsSearchForCompose: withAccount<{ query: string, organizations: boolean, limit?: number }>(async (args, uid, oid) => {

            // Do search
            let uids = await Modules.Users.searchForUsers(args.query, {
                uid,
                limit: args.limit || 10
            });

            if (uids.length === 0) {
                return [];
            }

            // Fetch profiles
            let users = await DB.User.findAll({
                where: [DB.connection.and({ id: { $in: uids } }, { status: 'ACTIVATED' })]
            });
            let restored: any[] = [];
            for (let u of uids) {
                let existing = users.find((v) => v.id === u);
                if (existing) {
                    restored.push(existing);
                }
            }
            return restored;
        }),
        alphaChatSearch: withUser<{ members: string[] }>(async (args, uid) => {
            let members = [...args.members.map((v) => IDs.User.parse(v)), uid];
            return await DB.txStable(async (tx) => {
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
        alphaGroupConversationMembers: withUser<{ conversationId: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let res = await FDB.RoomParticipant.allFromActive(conversationId);
            return res;
        }),
        alphaBlockedList: withUser<{ conversationId?: string }>(async (args, uid) => {
            return [];
        }),
        conversationDraft: withUser<{ conversationId: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return await Modules.Drafts.findDraft(uid, conversationId);
        }),
        alphaDraftMessage: withUser<{ conversationId: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return await Modules.Drafts.findDraft(uid, conversationId);
        }),
    },
    Mutation: {
        superCreateChat: withPermission<{ title: string }>('software-developer', async (args) => {
            await validate({ title: stringNotEmpty() }, args);
            return DB.Conversation.create({
                title: args.title
            });
        }),
        alphaReadChat: withUser<{ conversationId: string, messageId: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            await inTx(async () => {
                let msg = await FDB.Message.findById(messageId);
                if (!msg || msg.cid !== conversationId) {
                    throw Error('Invalid request');
                }

                let existing = await Modules.Messaging.repo.getUserDialogState(uid, conversationId);
                let global = await Modules.Messaging.repo.getUserMessagingState(uid);
                let delta = 0;
                let totalUnread = 0;
                if (!existing.readMessageId || existing.readMessageId < messageId) {
                    let remaining = (await FDB.Message.allFromChatAfter(conversationId, messageId)).filter((v) => v.uid !== uid).length - 1;
                    if (remaining === 0) {
                        delta = -existing.unread;
                        existing.unread = 0;
                        existing.readMessageId = messageId;
                    } else {
                        delta = remaining - existing.unread;
                        existing.unread = remaining;
                        existing.readMessageId = messageId;
                        totalUnread = remaining;
                    }
                }

                if (delta !== 0) {

                    //
                    // Update Global State
                    //

                    let unread = global.unread + delta;
                    if (unread < 0) {
                        throw Error('Internal inconsistency');
                    }
                    global.unread = unread;
                    global.seq++;

                    //
                    // Write Event
                    //

                    await FDB.UserDialogEvent.create(uid, global.seq, {
                        kind: 'message_read',
                        cid: conversationId,
                        unread: totalUnread,
                        allUnread: global.unread
                    });

                    //
                    // Update counter
                    //
                    await Modules.Push.sendCounterPush(uid, conversationId, global.unread);
                }
            });

            return {
                uid: uid,
                conversationId: conversationId
            };
        }),
        alphaGlobalRead: withUser<{ toSeq: number }>(async (args, uid) => {
            await inTx(async () => {
                let state = await Modules.Messaging.repo.getUserNotificationState(uid);
                state.readSeq = args.toSeq;
            });
            return 'ok';
        }),
        alphaSendMessage: withUser<{ conversationId: string, message?: string | null, file?: string | null, repeatKey?: string | null, replyMessages?: number[] | null, mentions?: number[] | null }>(async (args, uid) => {
            // validate({ message: stringNotEmpty() }, args);
            return await withLogContext('send-message', async () => {
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

                return await DB.txLight(async (tx) => {
                    return (await Repos.Chats.sendMessage(conversationId, uid!, {
                        message: args.message,
                        file: args.file,
                        fileMetadata,
                        repeatKey: args.repeatKey,
                        filePreview,
                        replyMessages: args.replyMessages,
                        mentions: args.mentions
                    }));
                });
            });
        }),
        alphaSendIntro: withUser<{ conversationId: string, userId: number, about: string, message?: string | null, file?: string | null, repeatKey?: string | null }>(async (args, uid) => {
            await validate(
                {
                    about: defined(stringNotEmpty(`About can't be empty!`)),
                    userId: defined(isNumber('Select user'))
                },
                args
            );

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

            return await DB.txLight(async (tx) => {
                let profile = (await Modules.Users.profileById(args.userId))!;

                if (!profile) {
                    throw new NotFoundError();
                }

                return (await Repos.Chats.sendMessage(conversationId, uid!, {
                    message: args.message,
                    file: args.file,
                    fileMetadata,
                    repeatKey: args.repeatKey,
                    filePreview,
                    urlAugmentation: {
                        type: 'intro',
                        extra: args.userId,
                        url: `https://next.openland.com/mail/u/${IDs.User.serialize(args.userId)}`,
                        title: profile.firstName + ' ' + profile.lastName,
                        subtitle: 'intro',
                        description: args.about,
                        imageURL: null,
                        imageInfo: null,
                        photo: profile!.picture,
                        hostname: 'openland.com',
                        iconRef: null,
                        iconInfo: null,
                    }
                }));
            });
        }),
        alphaEditIntro: withUser<{ messageId: string, userId: number, about: string, message?: string | null, file?: string | null, repeatKey?: string | null }>(async (args, uid) => {
            await validate(
                {
                    about: defined(stringNotEmpty(`About can't be empty!`)),
                    userId: defined(isNumber('Select user'))
                },
                args
            );

            let messageId = IDs.ConversationMessage.parse(args.messageId);

            let fileMetadata: JsonMap | null;
            let filePreview: string | null;

            if (args.file) {
                let fileInfo = await Services.UploadCare.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Services.UploadCare.fetchLowResPreview(args.file);
                }
            }

            return await DB.txLight(async (tx) => {
                let profile = (await Modules.Users.profileById(uid))!;

                if (!profile) {
                    throw new NotFoundError();
                }

                return await Repos.Chats.editMessage(tx, messageId, uid!, {
                    message: args.message,
                    file: args.file,
                    fileMetadata,
                    repeatKey: args.repeatKey,
                    filePreview,
                    urlAugmentation: {
                        type: 'intro',
                        extra: args.userId,
                        url: `https://next.openland.com/mail/u/${IDs.User.serialize(args.userId)}`,
                        title: profile.firstName + ' ' + profile.lastName,
                        subtitle: 'intro',
                        description: args.about,
                        imageURL: null,
                        imageInfo: null,
                        photo: profile!.picture,
                        hostname: 'openland.com',
                        iconRef: null,
                        iconInfo: null,
                    }
                }, true);
            });
        }),
        alphaEditMessage: withUser<{ messageId: string, message?: string | null, file?: string | null, replyMessages?: number[] | null, mentions?: number[] | null }>(async (args, uid) => {
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
                        filePreview,
                        replyMessages: args.replyMessages,
                        mentions: args.mentions
                    },
                    true
                );
            });
        }),
        alphaDeleteMessageUrlAugmentation: withUser<{ messageId: number }>(async (args, uid) => {
            return await DB.txStable(async (tx) => {
                return await Repos.Chats.editMessage(
                    tx,
                    args.messageId,
                    uid,
                    {
                        urlAugmentation: false
                    },
                    true
                );
            });
        }),
        alphaDeleteMessage: withUser<{ messageId: string }>(async (args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);

            return await DB.txStable(async (tx) => {
                return await Repos.Chats.deleteMessage(tx, messageId, uid);
            });
        }),
        alphaSetTyping: withUser<{ conversationId: string, type: string }>(async (args, uid) => {
            await validate({ type: optional(enumString(['text', 'photo'])) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type || 'text');
            return 'ok';
        }),

        alphaChatCreateGroup: withUser<{ title?: string | null, photoRef?: ImageRef | null, message?: string, members: string[] }>(async (args, uid) => {
            let conv = await DB.txStable(async (tx) => {
                let title = args.title ? args.title!! : '';

                let imageRef = Sanitizer.sanitizeImageRef(args.photoRef);

                if (imageRef) {
                    await Services.UploadCare.saveFile(imageRef.uuid);
                }

                let conv2 = await DB.Conversation.create({
                    title: title,
                    type: 'group',
                    ...(imageRef ? { extras: { picture: imageRef } } as any : {}),
                }, { transaction: tx });
                let members = [uid, ...args.members.map((v) => IDs.User.parse(v))];
                for (let m of members) {
                    await inTx(async () => {
                        await FDB.RoomParticipant.create(conv2.id, m, {
                            role: m === uid ? 'owner' : 'member',
                            invitedBy: uid,
                            status: 'joined'
                        });
                    });
                }

                return conv2;
            });
            if (args.message) {
                await Repos.Chats.sendMessage(conv.id, uid, { message: args.message });
            } else {
                await Repos.Chats.sendMessage(conv.id, uid, { message: 'Group created', isService: true });
            }
            return conv;
        }),
        alphaChatUpdateGroup: withUser<{ conversationId: string, input: { title?: string | null, description?: string | null, longDescription?: string | null, photoRef?: ImageRef | null, socialImageRef?: ImageRef | null } }>(async (args, uid) => {
            await validate(
                {
                    title: optional(stringNotEmpty('Title can\'t be empty!'))
                },
                args.input
            );

            let conversationId = IDs.Conversation.parse(args.conversationId);

            return await DB.txStable(async (tx) => {
                let chat = await DB.Conversation.findById(conversationId, { transaction: tx });

                if (!chat) {
                    throw new Error('Chat not found');
                }

                let curMember = await FDB.RoomParticipant.findById(conversationId, uid);
                let role = await Repos.Permissions.superRole(uid);

                let haveAccess = (curMember && (curMember.role === 'owner' || curMember.role === 'admin')) || role === 'super-admin';

                if (!haveAccess) {
                    throw new AccessDeniedError();
                }

                let chatChanged = false;

                if (args.input.title !== undefined && args.input.title !== chat.title) {
                    chatChanged = true;
                    chat.title = args.input.title!.trim();

                    await Repos.Chats.sendMessage(conversationId, uid, {
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

                    await Repos.Chats.sendMessage(conversationId, uid, {
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
                    (chat as any).changed('extras', true);
                    chat.extras.description = Sanitizer.sanitizeString(args.input.description);
                }
                if (args.input.longDescription !== undefined) {
                    chatChanged = true;
                    (chat as any).changed('extras', true);
                    chat.extras.longDescription = Sanitizer.sanitizeString(args.input.longDescription);
                }

                let socialImageRef = Sanitizer.sanitizeImageRef(args.input.socialImageRef);
                if (args.input.socialImageRef !== undefined && !imageRefEquals(chat.extras.socialImage as any || null, socialImageRef)) {
                    chatChanged = true;
                    if (args.input.socialImageRef !== null) {
                        await Services.UploadCare.saveFile(args.input.socialImageRef.uuid);
                    }
                    (chat as any).changed('extras', true);
                    chat.extras.socialImage = socialImageRef as any;
                }

                if (chatChanged) {
                    // await Repos.Chats.addChatEvent(
                    //     conversationId,
                    //     'chat_update',
                    //     {},
                    //     tx
                    // );

                    // await Repos.Chats.addUserEventsInConversation(
                    //     conversationId,
                    //     uid,
                    //     'chat_update',
                    //     {
                    //         conversationId
                    //     },
                    //     tx
                    // );

                    await chat.save({ transaction: tx });
                }

                await chat.reload({ transaction: tx });

                return {
                    chat,
                    curSeq: chat.seq
                };
            });
        }),
        alphaChatChangeGroupTitle: withUser<{ conversationId: string, title: string }>(async (args, uid) => {
            return DB.tx(async (tx) => {
                await validate({ title: defined(stringNotEmpty()) }, args);

                let conversationId = IDs.Conversation.parse(args.conversationId);

                let chat = await DB.Conversation.findById(conversationId, { transaction: tx });

                if (!chat || (chat.type !== 'group' && chat.type !== 'channel')) {
                    throw new Error('Chat not found');
                }

                await chat.update({
                    title: args.title
                }, { transaction: tx });

                // await Repos.Chats.addChatEvent(
                //     conversationId,
                //     'title_change',
                //     {
                //         title: args.title
                //     },
                //     tx
                // );

                // await Repos.Chats.addUserEventsInConversation(
                //     conversationId,
                //     uid,
                //     'title_change',
                //     {
                //         title: args.title
                //     },
                //     tx
                // );

                await Repos.Chats.sendMessage(conversationId, uid, {
                    message: `New chat title: ${args.title}`,
                    isService: true,
                    isMuted: true,
                    serviceMetadata: {
                        type: 'title_change',
                        title: args.title
                    }
                });

                return {
                    chat
                };
            });
        }),
        alphaChatInviteToGroup: withUser<{ conversationId: string, invites: { userId: string, role: string }[] }>(async (args, uid) => {
            return inTx(async () => {
                await validate({
                    invites: mustBeArray({
                        userId: defined(stringNotEmpty()),
                        role: defined(enumString(['member', 'admin']))
                    })
                }, args);

                let conversationId = IDs.Conversation.parse(args.conversationId);

                let chat = await DB.Conversation.findById(conversationId);

                if (!chat || (chat.type !== 'group' && chat.type !== 'channel')) {
                    throw new Error('Chat not found');
                }

                let curMember = await FDB.RoomParticipant.findById(conversationId, uid);

                if (!curMember) {
                    throw new AccessDeniedError();
                }

                for (let invite of args.invites) {
                    let userId = IDs.User.parse(invite.userId);

                    try {
                        await FDB.RoomParticipant.create(conversationId, userId, {
                            invitedBy: uid,
                            role: invite.role as any,
                            status: 'joined'
                        });
                    } catch (e) {
                        throw new Error('User already invited');
                    }
                }

                let users: UserProfile[] = [];

                for (let invite of args.invites) {
                    users.push((await Modules.Users.profileById(IDs.User.parse(invite.userId)))!);
                }

                await Repos.Chats.sendMessage(
                    conversationId,
                    uid,
                    {
                        message: `${users.map(u => u.firstName).join(', ')} joined chat`,
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'user_invite',
                            userIds: args.invites.map(i => IDs.User.parse(i.userId)),
                            invitedById: uid
                        }
                    }
                );

                // await Repos.Chats.addChatEvent(
                //     conversationId,
                //     'new_members',
                //     {
                //         userIds: args.invites.map(i => IDs.User.parse(i.userId)),
                //         invitedById: uid
                //     },
                //     tx
                // );

                // let membersCount = await Repos.Chats.membersCountInConversation(conversationId);

                // await Repos.Chats.addUserEventsInConversation(
                //     conversationId,
                //     uid,
                //     'new_members_count',
                //     {
                //         conversationId,
                //         membersCount: membersCount + args.invites.length
                //     },
                //     tx
                // );

                return {
                    chat
                };
            });
        }),
        alphaChatKickFromGroup: withUser<{ conversationId: string, userId: string }>(async (args, uid) => {
            return inTx(async () => {
                let conversationId = IDs.Conversation.parse(args.conversationId);
                let userId = IDs.User.parse(args.userId);

                let chat = await DB.Conversation.findById(conversationId);

                if (!chat || (chat.type !== 'group' && chat.type !== 'channel')) {
                    throw new Error('Chat not found');
                }

                let member = await FDB.RoomParticipant.findById(conversationId, userId);

                if (!member) {
                    throw new Error('No such member');
                }

                let isSuperAdmin = (await Repos.Permissions.superRole(uid)) === 'super-admin';

                let curMember = await FDB.RoomParticipant.findById(conversationId, uid);

                if (!curMember && !isSuperAdmin) {
                    throw new AccessDeniedError();
                }

                let canKick = isSuperAdmin || curMember!.role === 'admin' || curMember!.role === 'owner' || member.invitedBy === uid;

                if (!canKick) {
                    throw new AccessDeniedError();
                }

                curMember!.status = 'kicked';

                let profile = await Modules.Users.profileById(member.uid);

                await Repos.Chats.sendMessage(
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

                // await Repos.Chats.addChatEvent(
                //     conversationId,
                //     'kick_member',
                //     {
                //         userId: userId,
                //         kickedById: uid
                //     },
                //     tx
                // );

                // let membersCount = await Repos.Chats.membersCountInConversation(conversationId);

                // await Repos.Chats.addUserEventsInConversation(
                //     conversationId,
                //     uid,
                //     'new_members_count',
                //     {
                //         conversationId,
                //         membersCount: membersCount
                //     },
                //     tx
                // );

                await inTx(async () => {
                    let mstate = await Modules.Messaging.repo.getUserMessagingState(uid);
                    let convState = await Modules.Messaging.repo.getUserDialogState(uid, conversationId);
                    mstate.unread = mstate.unread - convState.unread;
                    mstate.seq++;

                    await FDB.UserDialogEvent.create(uid, mstate.seq, {
                        kind: 'message_read',
                        unread: 0,
                        allUnread: mstate.unread
                    });

                    return mstate;
                });

                return {
                    chat
                };
            });
        }),
        alphaChatChangeRoleInGroup: withUser<{ conversationId: string, userId: string, newRole: string }>(async (args, uid) => {
            return inTx(async () => {
                await validate({
                    newRole: defined(enumString(['member', 'admin']))
                }, args);

                let conversationId = IDs.Conversation.parse(args.conversationId);
                let userId = IDs.User.parse(args.userId);

                let chat = await DB.Conversation.findById(conversationId);

                if (!chat || (chat.type !== 'group' && chat.type !== 'channel')) {
                    throw new Error('Chat not found');
                }

                let member = await FDB.RoomParticipant.findById(conversationId, userId);

                if (!member) {
                    throw new Error('Member not found');
                }

                let curMember = await FDB.RoomParticipant.findById(conversationId, uid);

                if (!curMember) {
                    throw new AccessDeniedError();
                }

                let canChangeRole = curMember.role === 'admin' || curMember.role === 'owner';

                if (!canChangeRole) {
                    throw new AccessDeniedError();
                }

                member.role = args.newRole as any;

                // let chatEvent = await Repos.Chats.addChatEvent(
                //     conversationId,
                //     'update_role',
                //     {
                //         userId: userId,
                //         newRole: args.newRole
                //     },
                //     tx
                // );

                return {
                    chat
                };
            });
        }),

        alphaBlockUser: withUser<{ userId: string }>(async (args, uid) => {
            return 'ok';
        }),
        alphaUnblockUser: withUser<{ userId: string, conversationId?: string }>(async (args, uid) => {
            return 'ok';
        }),
        alphaUpdateConversationSettings: withUser<{ settings: { mobileNotifications?: 'all' | 'direct' | 'none' | null, mute?: boolean | null }, conversationId: string }>(async (args, uid) => {
            let cid = IDs.Conversation.parse(args.conversationId);
            return await inTx(async () => {
                let settings = await Modules.Messaging.getConversationSettings(uid, cid);
                if (args.settings.mute !== undefined && args.settings.mute !== null) {
                    settings.mute = args.settings.mute;
                }
                return settings;
            });
        }),
        conversationDraftUpdate: withUser<{ conversationId: string, message?: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);

            if (!args.message) {
                await Modules.Drafts.clearDraft(uid, conversationId);
            } else {
                await Modules.Drafts.saveDraft(uid, conversationId, args.message);
            }

            return 'ok';
        }),
        alphaSaveDraftMessage: withUser<{ conversationId: string, message?: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);

            if (!args.message) {
                await Modules.Drafts.clearDraft(uid, conversationId);
            } else {
                await Modules.Drafts.saveDraft(uid, conversationId, args.message);
            }

            return 'ok';
        }),
        alphaChatLeave: withAccount<{ conversationId: string }>(async (args, uid) => {
            return inTx(async () => {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                let chat = await DB.Conversation.findById(conversationId);

                if (!chat || (chat.type !== 'group' && chat.type !== 'channel')) {
                    throw new Error('Chat not found');
                }

                let member = await FDB.RoomParticipant.findById(conversationId, uid);

                if (!member) {
                    throw new Error('No such member');
                }
                let profile = await Modules.Users.profileById(uid);

                await Repos.Chats.sendMessage(
                    conversationId,
                    uid,
                    {
                        message: `${profile!.firstName} has left the chat`,
                        isService: true,
                        isMuted: true,
                        serviceMetadata: {
                            type: 'user_kick',
                            userId: uid,
                            kickedById: uid
                        }
                    }
                );

                // await Repos.Chats.addChatEvent(
                //     conversationId,
                //     'kick_member',
                //     {
                //         userId: uid,
                //         kickedById: uid
                //     },
                //     tx
                // );

                // let membersCount = await DB.ConversationGroupMembers.count({
                //     where: {
                //         conversationId: conversationId,
                //     },
                //     transaction: tx
                // });

                // await Repos.Chats.addUserEventsInConversation(
                //     conversationId,
                //     uid,
                //     'new_members_count',
                //     {
                //         conversationId,
                //         membersCount: membersCount
                //     },
                //     tx
                // );

                member.status = 'left';

                let mstate = await Modules.Messaging.repo.getUserMessagingState(uid);
                let convState = await Modules.Messaging.repo.getUserDialogState(uid, conversationId);
                mstate.unread = mstate.unread - convState.unread;
                mstate.seq++;

                await FDB.UserDialogEvent.create(uid, mstate.seq, {
                    kind: 'message_read',
                    unread: 0,
                    allUnread: mstate.unread
                });

                return {
                    chat,
                    curSeq: chat.seq
                };
            });
        }),

        alphaChatSetReaction: withAccount<{ messageId: number, reaction: string }>(async (args, uid) => {
            await Repos.Chats.setReaction(args.messageId, uid, args.reaction);
            return 'ok';
        }),
        alphaChatUnsetReaction: withAccount<{ messageId: number, reaction: string }>(async (args, uid) => {
            await Repos.Chats.setReaction(args.messageId, uid, args.reaction, true);
            return 'ok';
        }),
    },
    Subscription: {
        alphaSubscribeTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: any, context: CallContext) {
                if (!context.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Typings.createTypingStream(context.uid);
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

                return Modules.Typings.createTypingStream(context.uid, conversationId);
            }
        },
        alphaSubscribeChatOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { conversations: string[] }, context: CallContext) {
                let conversationIds = args.conversations.map(c => IDs.Conversation.parse(c));

                if (!context.uid) {
                    throw Error('Not logged in');
                }

                let uids: number[] = [];

                for (let chatId of conversationIds) {
                    uids.push(...await Repos.Chats.getConversationMembers(chatId));
                }

                return Modules.Presence.createPresenceStream(context.uid, uids);
            }
        },
        alphaSubscribeOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { users: number[] }, context: CallContext) {
                if (!context.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Presence.createPresenceStream(context.uid!, args.users);
            }
        }
    }
};