import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withPermission } from '../openland-module-api/Resolvers';
import { Emails } from '../openland-module-email/Emails';
import { FDB } from '../openland-module-db/FDB';
import { Comment, Message, Organization } from '../openland-module-db/schema';
import { IDs, IdsFactory } from '../openland-module-api/IDs';
import { Modules } from '../openland-modules/Modules';
import { createUrlInfoService } from '../openland-module-messaging/workers/UrlInfoService';
import { jBool, jField, jNumber, json, jString, validateJson } from '../openland-utils/jsonSchema';
import { inTx } from '../foundation-orm/inTx';
import { Context, createEmptyContext } from '../openland-utils/Context';

const URLInfoService = createUrlInfoService();

export default {
    DebugUserPresence: {
        user: src => src.uid,
        lastSeen: src => src.lastSeen,
        lastSeenStr: src => new Date(src.lastSeen).toString(),
        lastSeenTimeout: src => src.lastSeenTimeout,
        platform: src => src.platform,
        active: src => src.active,
    },
    Query: {
        debugParseID: withPermission('super-admin', async (ctx, args) => {
            let id = IdsFactory.resolve(args.id);
            return {
                numberID: typeof id.id === 'number' && id.id,
                stringID: typeof id.id === 'string' && id.id,
                type: id.type.typeName
            };
        }),
        debugCrashQuery: () => {
            throw new Error('Test crash!');
        },
        debugUrlInfo: withPermission('super-admin', async (ctx, args) => {
            return URLInfoService.fetchURLInfo(args.url, false);
        }),
        userPresence: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.uid);
            let presence = await FDB.Presence.allFromUser(ctx, uid);

            if (args.lastSeenFiveMinute === true) {
                let now = Date.now();
                return presence.filter(p => (now - p.lastSeen) <= 1000 * 60 * 5);
            }

            return presence;
        }),
        debugValidateMessages: withPermission('super-admin', async (ctx, args) => {
            let uid = ctx.auth.uid!;
            let messages: Message[] = [];
            let allDialogs = await FDB.UserDialog.allFromUser(ctx, uid);
            let res = '';
            for (let dialog of allDialogs) {
                let conv = (await FDB.Conversation.findById(ctx, dialog.cid))!;
                if (!conv) {
                    continue;
                }
                if (conv.kind === 'room') {
                    let pat = await FDB.RoomParticipant.findById(ctx, dialog.cid, uid);
                    if (!pat || pat.status !== 'joined') {
                        continue;
                    }
                }

                try {
                    messages.push(...await FDB.Message.allFromChat(ctx, dialog.cid));
                } catch (e) {
                    res += e.toString() + '\n\n';
                }
            }
            let fileMetadataSchema = json(() => {
                jField('isStored', jBool()).undefinable();
                jField('isImage', jBool()).nullable();
                jField('imageWidth', jNumber()).nullable();
                jField('imageHeight', jNumber()).nullable();
                jField('imageFormat', jString()).nullable();
                jField('mimeType', jString());
                jField('name', jString());
                jField('size', jNumber());
            });

            for (let message of messages) {
                try {
                    if (message.fileMetadata) {
                        validateJson(fileMetadataSchema, message.fileMetadata);
                    }
                } catch (e) {
                    res += e + '\n\n';
                }
            }
            return res;
        }),

        organizationChatsStats: withPermission('super-admin', async (ctx, args) => {
            let chats = await FDB.ConversationOrganization.findAll(ctx);

            let res: { org: Organization, chat: number, messagesCount: number, lastMessageDate: string }[] = [];

            for (let chat of chats) {
                let messages = await FDB.Message.allFromChat(ctx, chat.id);
                res.push({
                    org: (await FDB.Organization.findById(ctx, chat.oid))!,
                    chat: chat.id,
                    messagesCount: messages.length,
                    lastMessageDate: messages.length > 0 ? new Date(messages[messages.length - 1].createdAt).toString() : ''
                });
            }

            console.log(res);
            return res;
        }),
    },
    Mutation: {
        debugSendEmail: withPermission('super-admin', async (ctx, args) => {
            let uid = ctx.auth.uid!;
            let oid = ctx.auth.oid!;
            let type = args.type;
            let user = await FDB.User.findById(ctx, uid);
            let email = user!.email!;
            let isProd = process.env.APP_ENVIRONMENT === 'production';

            if (type === 'WELCOME') {
                await Emails.sendWelcomeEmail(ctx, uid);
            } else if (type === 'ACCOUNT_ACTIVATED') {
                await Emails.sendAccountActivatedEmail(ctx, oid, uid);
            } else if (type === 'ACCOUNT_DEACTIVATED') {
                await Emails.sendAccountDeactivatedEmail(ctx, oid, uid);
            } else if (type === 'MEMBER_REMOVED') {
                await Emails.sendMemberRemovedEmail(ctx, oid, uid);
            } else if (type === 'MEMBERSHIP_LEVEL_CHANGED') {
                await Emails.sendMembershipLevelChangedEmail(ctx, oid, uid);
            } else if (type === 'INVITE') {
                let invite = {
                    firstName: 'Test',
                    lastName: 'Test',
                    uid,
                    email: email,
                    entityName: '',
                    id: -1,
                    oid,
                    text: 'test',
                    ttl: -1,
                    enabled: true,
                    joined: false,
                    role: 'MEMBER'
                };

                await Emails.sendInviteEmail(ctx, oid, invite as any);
            } else if (type === 'MEMBER_JOINED') {
                await Emails.sendMemberJoinedEmails(ctx, oid, uid, uid, true);
            } else if (type === 'SIGNUP_CODE') {
                await Emails.sendActivationCodeEmail(ctx, email, '00000', false);
            } else if (type === 'SIGIN_CODE') {
                await Emails.sendActivationCodeEmail(ctx, email, '00000', true);
            } else if (type === 'UNREAD_MESSAGE') {
                let dialogs = await FDB.UserDialog.rangeFromUserWithCursor(ctx, uid, 10, undefined, true);
                let dialog = dialogs.items[0];
                let messages = await FDB.Message.rangeFromChat(ctx, dialog.cid, 1, true);

                await Emails.sendUnreadMessages(ctx, uid, messages);
            } else if (type === 'UNREAD_MESSAGES') {
                let dialogs = await FDB.UserDialog.rangeFromUserWithCursor(ctx, uid, 10, undefined, true);
                let messages: Message[] = [];

                for (let dialog of dialogs.items) {
                    let msgs = await FDB.Message.rangeFromChat(ctx, dialog.cid, 1, true);
                    messages.push(msgs[0]);
                }

                await Emails.sendUnreadMessages(ctx, uid, messages);
            } else if (type === 'PUBLIC_ROOM_INVITE') {
                let cid = IDs.Conversation.parse(isProd ? 'AL1ZPXB9Y0iq3yp4rx03cvMk9d' : 'd5z2ppJy6JSXx4OA00lxSJXmp6');

                await Emails.sendRoomInviteEmail(ctx, uid, email, cid, { id: 'xxxxx'} as any);
            } else if (type === 'PRIVATE_ROOM_INVITE') {
                let cid = IDs.Conversation.parse(isProd ? 'qljZr9WbMKSRlBZWbDo5U9qZW4' : 'vBDpxxEQREhQyOBB6l7LUDMwPE');

                await Emails.sendRoomInviteEmail(ctx, uid, email, cid, { id: 'xxxxx'} as any);
            } else if (type === 'ROOM_INVITE_ACCEPTED') {
                let cid = IDs.Conversation.parse(isProd ? 'AL1ZPXB9Y0iq3yp4rx03cvMk9d' : 'd5z2ppJy6JSXx4OA00lxSJXmp6');

                let invite = {
                    creatorId: uid,
                    channelId: cid
                };

                await Emails.sendRoomInviteAcceptedEmail(ctx, uid, invite as any);
            }

            return true;
        }),
        debugCreateTestUser: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async (ctx) => {
                let id = await Modules.Users.createTestUser(ctx, args.key, args.name);
                return await FDB.User.findById(ctx, id);
            });
        }),
        debugDeleteUrlInfoCache: withPermission('super-admin', async (ctx, args) => {
            await URLInfoService.deleteURLInfoCache(args.url);
            return true;
        }),
        debugDeleteUrlInfoCacheAll: withPermission('super-admin', async (ctx, args) => {
            return await URLInfoService.deleteURLInfoCacheAll(ctx);
        }),
        debugSuperNotifications: withPermission('super-admin', async (ctx, args) => {
            let uid = ctx.auth.uid!;
            let oid = ctx.auth.oid!;

            if (args.type === 'ON_SIGN_UP') {
                await Modules.Hooks.onSignUp(ctx, uid);
            } else if (args.type === 'ON_USER_PROFILE_CREATED') {
                await Modules.Hooks.onUserProfileCreated(ctx, uid);
            } else if (args.type === 'ON_ORG_ACTIVATED_BY_ADMIN') {
                await Modules.Hooks.onOrganizationActivated(ctx, oid, { type: 'BY_SUPER_ADMIN', uid });
            } else if (args.type === 'ON_ORG_ACTIVATED_VIA_INVITE') {
                await Modules.Hooks.onOrganizationActivated(ctx, oid, { type: 'BY_INVITE', inviteType: 'APP', inviteOwner: uid });
            } else if (args.type === 'ON_ORG_SUSPEND') {
                await Modules.Hooks.onOrganizationSuspended(ctx, oid, { type: 'BY_SUPER_ADMIN', uid });
            }
            return true;
        }),
        debugCalcUsersMessagingStats: withPermission('super-admin', async (parent, args) => {
            const calculateForUser = async (ctx: Context, uid: number) => {
                let all = await FDB.UserDialog.allFromUser(ctx, uid);
                let totalSent = 0;
                let totalReceived = 0;

                for (let a of all) {
                    let conv = (await FDB.Conversation.findById(ctx, a.cid))!;
                    if (!conv) {
                        continue;
                    }

                    if (conv.kind === 'room') {
                        let pat = await FDB.RoomParticipant.findById(ctx, a.cid, uid);
                        if (!pat || pat.status !== 'joined') {
                            a.unread = 0;
                            continue;
                        }
                    }
                    let messages = await FDB.Message.allFromChat(ctx, a.cid);
                    for (let message of messages) {
                        if (message.uid === uid) {
                            totalSent++;
                        } else {
                            totalReceived++;
                        }
                    }
                }

                return { totalSent, totalReceived };
            };

            let users = await FDB.User.findAll(parent);

            for (let user of users) {
                await inTx(createEmptyContext(), async (ctx) => {
                    try {
                        let {totalSent, totalReceived} = await calculateForUser(ctx, user.id);

                        let existing = await FDB.UserMessagingState.findById(ctx, user.id);
                        if (!existing) {
                            let created = await FDB.UserMessagingState.create(ctx, user.id, { seq: 0, unread: 0, messagesReceived: totalReceived, messagesSent: totalSent });
                            await created.flush();
                        } else {
                            existing.messagesSent = totalSent;
                            existing.messagesReceived = totalReceived;
                            await existing.flush();
                        }
                    } catch (e) {
                        console.log('debugCalcUsersMessagingStatsError', e);
                    }
                });
            }

            return true;
        }),
        debugCalcUsersChatsStats: withPermission('super-admin', async (parent, args) => {
            const calculateForUser = async (ctx: Context, uid: number) => {
                let all = await FDB.UserDialog.allFromUser(ctx, uid);
                let chatsCount = 0;
                let directChatsCount = 0;

                for (let a of all) {
                    let conv = (await FDB.Conversation.findById(ctx, a.cid))!;
                    if (!conv) {
                        continue;
                    }

                    chatsCount++;
                    if (conv.kind === 'private') {
                        directChatsCount++;
                    }
                }

                return { chatsCount, directChatsCount };
            };

            let users = await FDB.User.findAll(parent);

            for (let user of users) {
                await inTx(createEmptyContext(), async (ctx) => {
                    try {
                        let {chatsCount, directChatsCount} = await calculateForUser(ctx, user.id);

                        let existing = await FDB.UserMessagingState.findById(ctx, user.id);
                        if (!existing) {
                            let created = await FDB.UserMessagingState.create(ctx, user.id, { seq: 0, unread: 0, messagesReceived: 0, messagesSent: 0, chatsCount, directChatsCount });
                            await created.flush();
                        } else {
                            existing.chatsCount = chatsCount;
                            existing.directChatsCount = directChatsCount;
                            await existing.flush();
                        }
                    } catch (e) {
                        console.log('debugCalcUsersChatsStats', e);
                    }
                });
            }

            return true;
        }),
        debugConvertOrgChatToNormal: withPermission('super-admin', async (parent, args) => {
            return inTx(parent, async ctx => {
                let orgId = IDs.Organization.parse(args.orgId);

                let chat = await Modules.Messaging.room.resolveOrganizationChat(ctx, orgId);

                if (!chat || chat.kind !== 'organization') {
                    return false;
                }

                let org = await FDB.Organization.findById(ctx, orgId);
                let orgProfile = await FDB.OrganizationProfile.findById(ctx, orgId);

                if (!org || !orgProfile) {
                    return false;
                }

                chat.kind = 'room';
                await chat.flush();

                await FDB.ConversationRoom.create(ctx, chat.id, {
                    kind: 'public',
                    ownerId: org.ownerId,
                    oid: orgId,
                    featured: false,
                    listed: false,
                    isChannel: false,
                });
                await FDB.RoomProfile.create(ctx, chat.id, {
                    title: orgProfile.name,
                    image: orgProfile.photo,
                    description: orgProfile.about,
                });

                let orgMembers = await FDB.OrganizationMember.allFromOrganization(ctx, 'joined', orgId);
                for (let member of orgMembers) {
                    await FDB.RoomParticipant.create(ctx, chat.id, member.uid, {
                        role: member.uid === org.ownerId ? 'owner' : 'member',
                        invitedBy: org.ownerId,
                        status: 'joined'
                    });
                }

                return true;
            });
        }),
        debugDeleteEmptyOrgChats: withPermission('super-admin', async (parent, args) => {
            return inTx(parent, async ctx => {
                let chats = await FDB.ConversationOrganization.findAll(ctx);
                for (let chat of chats) {
                    let room = await FDB.ConversationRoom.findById(ctx, chat.id);
                    if (room) {
                        // ignore converted chats
                        continue;
                    }
                    let messages = await FDB.Message.allFromChat(ctx, chat.id);
                    if (messages.length <= 1) {
                        await Modules.Messaging.room.deleteRoom(ctx, chat.id, parent.auth!.uid!);
                    }
                }
                return true;
            });
        }),
        debugFixCommentsVisibility: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async (ctx) => {
                let commentSeqs = await FDB.CommentSeq.findAll(ctx);

                for (let state of commentSeqs) {
                    let comments = await FDB.Comment.allFromPeer(ctx, state.peerType as any, state.peerId);

                    let id2Comment = new Map<number, Comment>();
                    for (let comment of comments) {
                        id2Comment.set(comment.id, comment);
                    }

                    let commentVisible = new Map<number, boolean>();

                    for (let comment of comments) {
                        if (comment.deleted) {
                            continue;
                        }

                        commentVisible.set(comment.id, true);
                        let c: Comment | undefined = comment;
                        while (c && c.parentCommentId) {
                            if (commentVisible.get(c.parentCommentId)) {
                                break;
                            }

                            commentVisible.set(c.parentCommentId, true);
                            c = id2Comment.get(c.parentCommentId);
                        }
                    }

                    for (let comment of comments) {
                        comment.visible = commentVisible.get(comment.id) || false;
                    }
                }

                return true;
            });
        }),
        debugSetCommentVisibility: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async (ctx) => {
                let comment = await FDB.Comment.findById(ctx, IDs.Comment.parse(args.commentId));
                if (comment) {
                    comment.visible = args.visible;
                }
                return true;
            });
        })
    }
} as GQLResolver;