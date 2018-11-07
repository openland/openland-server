import { IDs, IdsFactory } from '../openland-server/api/utils/IDs';
import { withUser, resolveUser, withAccount } from '../openland-server/api/utils/Resolvers';
import {
    validate,
    stringNotEmpty,
    enumString,
    optional,
    defined,
    mustBeArray,
    isNumber
} from '../openland-server/modules/NewInputValidator';
import { CallContext } from '../openland-server/api/utils/CallContext';
import { Repos } from '../openland-server/repositories';
import { JsonMap } from '../openland-server/utils/json';
import { IDMailformedError } from '../openland-server/errors/IDMailformedError';
import { UserError } from '../openland-server/errors/UserError';
import { NotFoundError } from '../openland-server/errors/NotFoundError';
import { Sanitizer } from '../openland-server/modules/Sanitizer';
import { URLAugmentation } from './workers/UrlInfoService';
import { Modules } from 'openland-modules/Modules';
import { OnlineEvent } from '../openland-module-presences/PresenceModule';
import { UserDialogSettings, Message, RoomParticipant, Conversation, Organization, User } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { TypingEvent } from 'openland-module-typings/TypingEvent';
import { withLogContext } from 'openland-log/withLogContext';
import { FDB } from 'openland-module-db/FDB';
import { FEntity } from 'foundation-orm/FEntity';
import { buildBaseImageUrl, ImageRef } from 'openland-module-media/ImageRef';

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
        flexibleId: async (src: Conversation, _: any, context: CallContext) => {
            return IDs.Conversation.serialize((await FDB.ConversationOrganization.findById(src.id))!.oid);
        },
        title: async (src: Conversation, _: any, context: CallContext) => {
            return (await FDB.OrganizationProfile.findById((await FDB.ConversationOrganization.findById(src.id))!.oid))!.name;
        },
        photos: async (src: Conversation, _: any, context: CallContext) => {
            let p = (await FDB.OrganizationProfile.findById((await FDB.ConversationOrganization.findById(src.id))!.oid))!.photo;
            if (p) {
                return [buildBaseImageUrl(p)];
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
            return FDB.OrganizationProfile.findById((await FDB.ConversationOrganization.findById(src.id))!.oid);
        },
        settings: (src: Conversation, _: any, context: CallContext) => Modules.Messaging.getConversationSettings(context.uid!!, src.id),
    },
    PrivateConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: async (src: Conversation, _: any, context: CallContext) => {
            let conv = (await FDB.ConversationPrivate.findById(src.id))!;
            if (!conv) {
                console.warn('Unable to find private conversation: ' + src.id);
            }
            if (conv.uid1 === context.uid) {
                return IDs.User.serialize(conv.uid2);
            } else if (conv.uid2 === context.uid) {
                return IDs.User.serialize(conv.uid1);
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
        },
        title: async (src: Conversation, _: any, context: CallContext) => {
            let uid;
            let conv = (await FDB.ConversationPrivate.findById(src.id))!;
            if (conv.uid1 === context.uid) {
                uid = conv.uid2;
            } else if (conv.uid2 === context.uid) {
                uid = conv.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            let profile = (await Modules.Users.profileById(uid))!;
            return [profile.firstName, profile.lastName].filter((v) => !!v).join(' ');
        },
        photos: async (src: Conversation, _: any, context: CallContext) => {
            let uid;
            let conv = (await FDB.ConversationPrivate.findById(src.id))!;
            if (conv.uid1 === context.uid) {
                uid = conv.uid2;
            } else if (conv.uid2 === context.uid) {
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
            let conv = (await FDB.ConversationPrivate.findById(src.id))!;
            if (conv.uid1 === context.uid) {
                uid = conv.uid2;
            } else if (conv.uid2 === context.uid) {
                uid = conv.uid1;
            } else {
                throw Error('Inconsistent Private Conversation resolver');
            }
            return FDB.User.findById(uid);
        },
        blocked: async (src: Conversation, _: any, context: CallContext) => false,
        settings: (src: Conversation, _: any, context: CallContext) => Modules.Messaging.getConversationSettings(context.uid!!, src.id),
    },
    GroupConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: async (src: Conversation, _: any, context: CallContext) => {
            let conv = (await FDB.RoomProfile.findById(src.id))!;
            if (!conv) {
                console.warn('Unable to find room for id: ' + src.id);
            }
            if (conv.title !== '') {
                return conv.title;
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
            return res.map((v) => FDB.User.findById(v.uid));
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

        photo: async (src: Conversation) => buildBaseImageUrl((await FDB.RoomProfile.findById(src.id))!.image),
        photoRef: async (src: Conversation) => (await FDB.RoomProfile.findById(src.id))!.image,
        description: async (src: Conversation) => (await FDB.RoomProfile.findById(src.id))!.description,
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
        myRole: async (src: Conversation, _: any, ctx: CallContext) => {
            let member = await Modules.Messaging.room.findMembershipStatus(ctx.uid!, src.id);

            return member && member.role;
        }
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
        urlAugmentation: (src: Message) => src.augmentation,
        edited: (src: Message) => (src.edited) || false,
        reactions: (src: Message) => src.reactions || [],
        replyMessages: async (src: Message) => {
            return src.replyMessages ? (src.replyMessages as number[]).map(id => FDB.Message.findById(id)) : null;
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
        conversation: (src: TypingEvent) => FDB.Conversation.findById(src.conversationId),
        user: (src: TypingEvent) => FDB.User.findById(src.userId),
    },
    OnlineEvent: {
        type: (src: OnlineEvent) => src.online ? 'online' : 'offline',
        user: (src: OnlineEvent) => FDB.User.findById(src.userId),
        timeout: (src: OnlineEvent) => src.timeout,
    },

    GroupConversationMember: {
        role: (src: RoomParticipant) => src.role === 'owner' ? 'creator' : src.role,
        user: (src: RoomParticipant) => FDB.User.findById(src.uid)
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
                    return Modules.Messaging.conv.resolvePrivateChat(shortName.ownerId!, uid);
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
                    return Modules.Messaging.conv.resolvePrivateChat(id.id, uid);
                } else if (id.type === IDs.Organization) {
                    let member = await FDB.OrganizationMember.findById(id.id, uid);
                    if (!member || member.status !== 'joined') {
                        throw new IDMailformedError('Invalid id');
                    }
                    return Modules.Messaging.conv.resolveOrganizationChat(id.id);
                } else {
                    throw new IDMailformedError('Invalid id');
                }
            } else {
                throw new UserError('No id passed');
            }
        }),
        alphaLoadMessages: withUser<{ conversationId: string, first?: number, before?: string, after?: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);

            await Modules.Messaging.conv.checkAccess(uid, conversationId);

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
        alphaChatSearch: withUser<{ members: string[] }>(async (args, uid) => {
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
        alphaGroupConversationMembers: withUser<{ conversationId: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let res = await FDB.RoomParticipant.allFromActive(conversationId);
            return res;
        }),
        alphaBlockedList: withUser<{ conversationId?: string }>(async (args, uid) => {
            return [];
        })
    },
    Mutation: {
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
                    let remaining = Math.max((await FDB.Message.allFromChatAfter(conversationId, messageId)).filter((v) => v.uid !== uid).length - 1, 0);
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
                    let fileInfo = await Modules.Media.saveFile(args.file);
                    fileMetadata = fileInfo as any;

                    if (fileInfo.isImage) {
                        filePreview = await Modules.Media.fetchLowResPreview(args.file);
                    }
                }

                return await inTx(async () => {
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
                let fileInfo = await Modules.Media.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(args.file);
                }
            }

            return await inTx(async () => {
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
                let fileInfo = await Modules.Media.saveFile(args.file);
                fileMetadata = fileInfo as any;

                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(args.file);
                }
            }

            return await inTx(async () => {
                let profile = (await Modules.Users.profileById(uid))!;

                if (!profile) {
                    throw new NotFoundError();
                }

                return await Repos.Chats.editMessage(messageId, uid!, {
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

            return await Repos.Chats.editMessage(messageId, uid, {
                message: args.message,
                file: args.file,
                fileMetadata,
                filePreview,
                replyMessages: args.replyMessages,
                mentions: args.mentions
            }, true);
        }),
        alphaDeleteMessageUrlAugmentation: withUser<{ messageId: number }>(async (args, uid) => {
            return await inTx(async () => {
                return await Repos.Chats.editMessage(
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
            return await Repos.Chats.deleteMessage(messageId, uid);
        }),

        //
        // Group Management
        //

        alphaChatCreateGroup: withAccount<{ title?: string | null, photoRef?: ImageRef | null, message?: string, members: string[] }>(async (args, uid, oid) => {
            let title = args.title ? args.title!! : '';
            let imageRef = Sanitizer.sanitizeImageRef(args.photoRef);
            if (imageRef) {
                await Modules.Media.saveFile(imageRef.uuid);
            }
            return Modules.Messaging.conv.createRoom('group', oid, uid, args.members.map((v) => IDs.User.parse(v)), {
                title: title,
                image: imageRef
            }, args.message);
        }),
        alphaChatUpdateGroup: withUser<{ conversationId: string, input: { title?: string | null, description?: string | null, longDescription?: string | null, photoRef?: ImageRef | null, socialImageRef?: ImageRef | null } }>(async (args, uid) => {
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

            let conv = await Modules.Messaging.conv.updateRoomProfile(conversationId, uid, {
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
        alphaChatInviteToGroup: withUser<{ conversationId: string, invites: { userId: string, role: string }[] }>(async (args, uid) => {
            await validate({
                invites: mustBeArray({
                    userId: defined(stringNotEmpty()),
                    role: defined(enumString(['member', 'admin']))
                })
            }, args);

            let conversationId = IDs.Conversation.parse(args.conversationId);

            let members = args.invites.map((v) => IDs.User.parse(v.userId));

            let chat = await Modules.Messaging.conv.inviteToRoom(conversationId, uid, members);
            return {
                chat
            };
        }),
        alphaChatKickFromGroup: withUser<{ conversationId: string, userId: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let userId = IDs.User.parse(args.userId);
            return inTx(async () => {
                let chat = await Modules.Messaging.conv.kickFromRoom(conversationId, uid, userId);
                return {
                    chat
                };
            });
        }),
        alphaChatChangeRoleInGroup: withUser<{ conversationId: string, userId: string, newRole: string }>(async (args, uid) => {
            await validate({
                newRole: defined(enumString(['member', 'admin']))
            }, args);

            let conversationId = IDs.Conversation.parse(args.conversationId);
            let userId = IDs.User.parse(args.userId);

            let conv = await Modules.Messaging.conv.updateMemberRole(conversationId, uid, userId, args.newRole as any);

            return {
                chat: conv
            };
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
        alphaChatLeave: withAccount<{ conversationId: string }>(async (args, uid) => {
            return inTx(async () => {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                let res = await Modules.Messaging.conv.leaveRoom(conversationId, uid);

                return {
                    chat: res
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
                    uids.push(...await Modules.Messaging.conv.findConversationMembers(chatId));
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