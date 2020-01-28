import {
    Organization,
    Message,
    Comment,
    DialogNeedReindexEvent, OrganizationProfile,
} from './../openland-module-db/store';
import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withPermission, withUser } from '../openland-module-api/Resolvers';
import { Emails } from '../openland-module-email/Emails';
import { Store } from '../openland-module-db/FDB';
import { IDs, IdsFactory } from '../openland-module-api/IDs';
import { Modules } from '../openland-modules/Modules';
import { createUrlInfoService } from '../openland-module-messaging/workers/UrlInfoService';
import { inTx, encoders } from '@openland/foundationdb';
import { AppContext } from '../openland-modules/AppContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { ddMMYYYYFormat, delay } from '../openland-utils/timer';
import { randomInt, randomKey } from '../openland-utils/random';
import { debugTask, debugTaskForAll } from '../openland-utils/debugTask';
import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { cursorToTuple } from '@openland/foundationdb-entity/lib/indexes/utils';
import { buildMessage, heading } from '../openland-utils/MessageBuilder';
import { AuthContext } from '../openland-module-auth/AuthContext';

const URLInfoService = createUrlInfoService();
const rootCtx = createNamedContext('resolver-debug');
const logger = createLogger('debug');

const nextDebugSeq = async (ctx: Context, uid: number) => {
    let state = await Store.DebugEventState.findById(ctx, uid!);
    if (!state) {
        await Store.DebugEventState.create(ctx, uid!, {seq: 1});
        return 1;
    } else {
        state.seq++;
        await state.flush(ctx);
        return state.seq;
    }
};

const createDebugEvent = async (parent: Context, uid: number, key: string) => {
    return inTx(parent, async (ctx) => {
        let seq = await nextDebugSeq(ctx, uid);
        await Store.DebugEvent.create(ctx, uid!, seq, {key});
    });
};

const isChatMuted = async (ctx: Context, uid: number, cid: number) => {
    let settings = await Store.UserDialogSettings.findById(ctx, uid, cid);
    if (settings && settings.mute) {
        return true;
    }
    return false;
};

const ServerId = randomKey();

export default {
    DebugUserPresence: {
        user: src => src.uid,
        lastSeen: src => src.lastSeen,
        lastSeenStr: src => new Date(src.lastSeen).toString(),
        lastSeenTimeout: src => src.lastSeenTimeout,
        platform: src => src.platform,
        active: src => src.active,
    },
    DebugEvent: {
        seq: src => src.seq,
        key: src => src.key,
    },
    Query: {
        lifecheck: () => `i'm ok`,
        debugParseID: withPermission('super-admin', async (ctx, args) => {
            let id = IdsFactory.resolve(args.id);
            return {
                numberID: typeof id.id === 'number' && id.id,
                stringID: typeof id.id === 'string' && id.id,
                type: id.type.typeName,
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
            let presence = await Store.Presence.user.findAll(ctx, uid);

            if (args.lastSeenFiveMinute === true) {
                let now = Date.now();
                return presence.filter(p => (now - p.lastSeen) <= 1000 * 60 * 5);
            }

            return presence;
        }),
        debugValidateMessages: withPermission('super-admin', async (ctx, args) => {
            return 'ok';
        }),
        organizationChatsStats: withPermission('super-admin', async (ctx, args) => {
            let chats = await Store.ConversationOrganization.findAll(ctx);

            let res: { org: Organization, chat: number, messagesCount: number, lastMessageDate: string }[] = [];

            for (let chat of chats) {
                let messages = await Store.Message.chat.findAll(ctx, chat.id);
                res.push({
                    org: (await Store.Organization.findById(ctx, chat.oid))!,
                    chat: chat.id,
                    messagesCount: messages.length,
                    lastMessageDate: messages.length > 0 ? new Date(messages[messages.length - 1].metadata.createdAt).toString() : '',
                });
            }

            return res;
        }),
        debugEventsState: withPermission('super-admin', async (ctx, args) => {
            let tail = await Store.DebugEvent.user.stream(ctx.auth.uid!, {batchSize: 1}).tail(ctx);
            return {state: tail};
        }),
        debugCheckTasksIndex: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'debugTasksIndex', async (log) => {
                // let workers = [
                //     'emailSender',
                //     'push_sender',
                //     'push_sender_firebase',
                //     'push_sender_apns',
                //     'push_sender_web',
                //     'conversation_message_push_delivery',
                //     'comment_augmentation_task',
                //     'conversation_message_delivery',
                //     'conversation_message_task',
                // ];

                // for (let worker of workers) {
                //     let duplicatesCount = await checkIndexConsistency(parent, FDB.Task, ['__indexes', 'pending', worker], value => [value.taskType, value.uid]);
                //     await log(`${worker} ${duplicatesCount} duplicates pending`);
                // }

                // let duplicatesCountExecuting = await checkIndexConsistency(parent, FDB.Task, ['__indexes', 'executing'], value => [value.taskType, value.uid]);
                // await log(`${duplicatesCountExecuting} duplicates executing`);

                // let duplicatesCountFailing = await checkIndexConsistency(parent, FDB.Task, ['__indexes', 'failing'], value => [value.taskType, value.uid]);
                // await log(`${duplicatesCountFailing} duplicates failing`);

                return 'done';
            });
            return 'ok';
        }),
        debug2WayDirectChatsCounter: withPermission('super-admin', async (parent, args) => {
            return await Store.User2WayDirectChatsCounter.get(parent, parent.auth.uid!);
        }),
        debugUserMetrics: withPermission('super-admin', async (ctx, args) => {
            let uid = await IDs.User.parse(args.id);
            return {
                messagesSent: await Store.UserMessagesSentCounter.get(ctx, uid),
                messagesReceived: await Store.UserMessagesReceivedCounter.get(ctx, uid),
                totalChatsCount: await Store.UserMessagesChatsCounter.get(ctx, uid),
                directChatsCount: await Store.UserMessagesDirectChatsCounter.get(ctx, uid),
                direct2WayChatsCount: await Store.User2WayDirectChatsCounter.get(ctx, uid),
                directMessagesSent: await Store.UserMessagesSentInDirectChatTotalCounter.get(ctx, uid),
                successfulInvitesCount: await Store.UserSuccessfulInvitesCounter.get(ctx, uid),
                audienceCount: await Store.UserAudienceCounter.get(ctx, uid),
            };
        }),
        debugGlobalCounters: withUser(async (ctx, args, uid) => {
            return {
                allUnreadMessages: await Store.UserGlobalCounterAllUnreadMessages.get(ctx, uid),
                unreadMessagesWithoutMuted: await Store.UserGlobalCounterUnreadMessagesWithoutMuted.get(ctx, uid),
                allUnreadChats: await Store.UserGlobalCounterAllUnreadChats.get(ctx, uid),
                unreadChatsWithoutMuted: await Store.UserGlobalCounterUnreadChatsWithoutMuted.get(ctx, uid),
            };
        }),
        debugServerId: withUser(async (ctx, args, uid) => {
            return ServerId;
        }),
    },
    Mutation: {
        lifecheck: () => `i'm still ok`,
        debugSendEmail: withPermission('super-admin', async (ctx, args) => {
            let uid = ctx.auth.uid!;
            let oid = ctx.auth.oid!;
            let type = args.type;
            let user = await Store.User.findById(ctx, uid);
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
                    role: 'MEMBER',
                };

                await Emails.sendInviteEmail(ctx, oid, invite as any);
            } else if (type === 'MEMBER_JOINED') {
                await Emails.sendMemberJoinedEmails(ctx, oid, uid, uid, true);
            } else if (type === 'SIGNUP_CODE') {
                await Emails.sendActivationCodeEmail(ctx, email, '00000', false);
            } else if (type === 'SIGIN_CODE') {
                await Emails.sendActivationCodeEmail(ctx, email, '00000', true);
            } else if (type === 'UNREAD_MESSAGE') {
                let dialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                let dialog = dialogs[0];
                let messages = await Store.Message.chat.query(ctx, dialog.cid, {limit: 1, reverse: true});

                await Emails.sendUnreadMessages(ctx, uid, messages.items);
            } else if (type === 'UNREAD_MESSAGES') {
                let dialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                let messages: Message[] = [];

                for (let dialog of dialogs) {
                    let msgs = await Store.Message.chat.query(ctx, dialog.cid, {limit: 1, reverse: true});
                    messages.push(msgs.items[0]);
                }

                await Emails.sendUnreadMessages(ctx, uid, messages);
            } else if (type === 'PUBLIC_ROOM_INVITE') {
                let cid = IDs.Conversation.parse(isProd ? 'AL1ZPXB9Y0iq3yp4rx03cvMk9d' : 'd5z2ppJy6JSXx4OA00lxSJXmp6');

                await Emails.sendRoomInviteEmail(ctx, uid, email, cid, {id: 'xxxxx'} as any);
            } else if (type === 'PRIVATE_ROOM_INVITE') {
                let cid = IDs.Conversation.parse(isProd ? 'qljZr9WbMKSRlBZWbDo5U9qZW4' : 'vBDpxxEQREhQyOBB6l7LUDMwPE');

                await Emails.sendRoomInviteEmail(ctx, uid, email, cid, {id: 'xxxxx'} as any);
            } else if (type === 'ROOM_INVITE_ACCEPTED') {
                let cid = IDs.Conversation.parse(isProd ? 'AL1ZPXB9Y0iq3yp4rx03cvMk9d' : 'd5z2ppJy6JSXx4OA00lxSJXmp6');

                let invite = {
                    creatorId: uid,
                    channelId: cid,
                };

                await Emails.sendRoomInviteAcceptedEmail(ctx, uid, invite as any);
            } else if (type === 'WEEKLY_DIGEST') {
                await Emails.sendWeeklyDigestEmail(ctx, uid);
            }

            return true;
        }),
        debugSerializeId: withPermission('super-admin', async (ctx, args) => {
            if (!(IDs as any)[args.type]) {
                throw new NotFoundError();
            }
            return (IDs as any)[args.type].serialize(args.id);
        }),
        debugCreateTestUser: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async (ctx) => {
                let id = await Modules.Users.createTestUser(ctx, args.key, args.name);
                return await Store.User.findById(ctx, id);
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
                await Modules.Hooks.onOrganizationActivated(ctx, oid, {type: 'BY_SUPER_ADMIN', uid});
            } else if (args.type === 'ON_ORG_ACTIVATED_VIA_INVITE') {
                await Modules.Hooks.onOrganizationActivated(ctx, oid, {
                    type: 'BY_INVITE',
                    inviteType: 'APP',
                    inviteOwner: uid,
                });
            } else if (args.type === 'ON_ORG_SUSPEND') {
                await Modules.Hooks.onOrganizationSuspended(ctx, oid, {type: 'BY_SUPER_ADMIN', uid});
            }
            return true;
        }),
        debugCalcUsersMessagingStats: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'calcUserChatsStats', async (log) => {
                const calculateForUser = async (ctx: Context, uid: number) => {
                    let all = await Modules.Messaging.findUserDialogs(ctx, uid);
                    let totalSent = 0;
                    let totalSentDirect = 0;
                    let totalReceived = 0;

                    for (let a of all) {
                        let conv = (await Store.Conversation.findById(ctx, a.cid))!;
                        if (!conv) {
                            continue;
                        }

                        if (conv.kind === 'room') {
                            let pat = await Store.RoomParticipant.findById(ctx, a.cid, uid);
                            if (!pat || pat.status !== 'joined') {
                                // a.unread = 0;
                                continue;
                            }
                        }
                        let messages = await Store.Message.chat.findAll(ctx, a.cid);
                        for (let message of messages) {
                            if (message.uid === uid) {
                                totalSent++;
                                if (conv.kind === 'private') {
                                    totalSentDirect++;
                                }
                            } else {
                                totalReceived++;
                            }
                        }
                    }

                    return {totalSent, totalReceived, totalSentDirect};
                };

                let users = await Store.User.findAll(parent);

                let i = 0;
                for (let user of users) {
                    i++;
                    if (i % 100 === 0) {
                        await log('processed ' + i + ' users');
                    }
                    await inTx(rootCtx, async (ctx) => {
                        try {
                            let {totalSent, totalReceived, totalSentDirect} = await calculateForUser(ctx, user.id);

                            let messagesSent = Store.UserMessagesSentCounter.byId(user.id);
                            messagesSent.set(ctx, totalSent);

                            let messagesSentDirect = Store.UserMessagesSentInDirectChatTotalCounter.byId(user.id);
                            messagesSentDirect.set(ctx, totalSentDirect);

                            let messagesReceived = Store.UserMessagesReceivedCounter.byId(user.id);
                            messagesReceived.set(ctx, totalReceived);
                        } catch (e) {
                            logger.log(rootCtx, e, 'debugCalcUsersMessagingStatsError');
                        }
                    });
                }
                return 'done';
            });

            return true;
        }),
        debugConvertOrgChatToNormal: withPermission('super-admin', async (parent, args) => {
            return inTx(parent, async ctx => {
                let orgId = IDs.Organization.parse(args.orgId);

                let chat = await Modules.Messaging.room.resolveOrganizationChat(ctx, orgId);

                if (!chat || chat.kind !== 'organization') {
                    return false;
                }

                let org = await Store.Organization.findById(ctx, orgId);
                let orgProfile = await Store.OrganizationProfile.findById(ctx, orgId);

                if (!org || !orgProfile) {
                    return false;
                }

                chat.kind = 'room';
                await chat.flush(ctx);

                let room = await Store.ConversationRoom.findById(ctx, chat.id);
                if (room) {
                    // in some cases org chats already have room, i donn't know why
                    room.kind = 'public';
                    room.ownerId = org.ownerId;
                    room.oid = orgId;
                    room.featured = false;
                    room.listed = false;
                    room.isChannel = false;
                    await room.flush(ctx);
                } else {
                    await Store.ConversationRoom.create(ctx, chat.id, {
                        kind: 'public',
                        ownerId: org.ownerId,
                        oid: orgId,
                        featured: false,
                        listed: false,
                        isChannel: false,
                    });
                }

                await Store.RoomProfile.create(ctx, chat.id, {
                    title: orgProfile.name,
                    image: orgProfile.photo,
                    description: orgProfile.about,
                });

                let orgMembers = await Store.OrganizationMember.organization.findAll(ctx, 'joined', orgId);
                for (let member of orgMembers) {
                    await Store.RoomParticipant.create(ctx, chat.id, member.uid, {
                        role: member.uid === org.ownerId ? 'owner' : 'member',
                        invitedBy: org.ownerId,
                        status: 'joined',
                    });
                }

                return true;
            });
        }),
        debugDeleteEmptyOrgChats: withPermission('super-admin', async (parent, args) => {
            let chats = await Store.ConversationOrganization.findAll(parent);
            let i = 0;
            for (let chat of chats) {
                await inTx(rootCtx, async ctx => {
                    let conv = await Store.Conversation.findById(ctx, chat.id);
                    if (conv && conv.deleted) {
                        // ignore already deleted chats
                        logger.log(ctx, 'debugDeleteEmptyOrgChats', chat.id, i, 'ignore deleted');
                        i++;
                        return;
                    }
                    if (conv && conv.kind !== 'organization') {
                        // ignore already converted chats
                        logger.log(ctx, 'debugDeleteEmptyOrgChats', chat.id, i, 'ignore already converted');
                        i++;
                        return;
                    }

                    logger.log(ctx, 'debugDeleteEmptyOrgChats', chat.id, i);
                    try {
                        await Modules.Messaging.room.deleteRoom(ctx, chat.id, parent.auth!.uid!);
                        i++;
                    } catch (e) {
                        logger.log(ctx, 'debugDeleteEmptyOrgChatsError', e);
                        logger.log(ctx, e);
                    }
                });
            }
            return true;
        }),
        debugFixCommentsVisibility: withPermission('super-admin', async (ctx, args) => {
            debugTask(ctx.auth.uid!, 'debugReindexOrgs', async (log) => {
                let commentSeqs = await Store.CommentSeq.findAll(ctx);
                let i = 0;

                for (let state of commentSeqs) {
                    await inTx(rootCtx, async _ctx => {
                        let comments = await Store.Comment.peer.findAll(_ctx, state.peerType as any, state.peerId);

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

                        let visibleCount = 0;
                        for (let comment of comments) {
                            comment.visible = commentVisible.get(comment.id) || false;
                            if (commentVisible.get(comment.id)) {
                                visibleCount++;
                            }
                        }

                        let existing = await Store.CommentState.findById(_ctx, state.peerType, state.peerId);
                        if (existing) {
                            existing.commentsCount = visibleCount;
                        }

                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                        i++;
                    });
                }
                return 'done';
            });
            return true;
        }),
        debugSetCommentVisibility: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async (ctx) => {
                let comment = await Store.Comment.findById(ctx, IDs.Comment.parse(args.commentId));
                if (comment) {
                    comment.visible = args.visible;
                }
                return true;
            });
        }),
        debugRemoveDeletedDialogs: withPermission('super-admin', async (ctx, args) => {
            debugTask(ctx.auth.uid!, 'debugRemoveDeletedDialogs', async (log) => {
                let users = await Store.User.findAll(rootCtx);
                let i = 0;
                for (let user of users) {
                    try {
                        await inTx(rootCtx, async _ctx => {
                            let all = await Modules.Messaging.findUserDialogs(_ctx, user.id);
                            for (let dialog of all) {
                                let conv = (await Store.Conversation.findById(_ctx, dialog.cid))!;
                                if (!conv || conv.deleted) {
                                    await Modules.Messaging.room.onDialogDelete(_ctx, dialog.cid, user.id);
                                }
                            }
                        });

                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                    } catch (e) {
                        await log('error: ' + e);
                    }
                    i++;
                }
                return 'done';
            });
            return true;
        }),
        debugReindexOrgs: withPermission('super-admin', async (ctx, args) => {
            debugTask(ctx.auth.uid!, 'debugReindexOrgs', async (log) => {
                let orgs = await Store.Organization.findAll(rootCtx);
                let i = 0;
                for (let o of orgs) {
                    try {
                        await inTx(rootCtx, async _ctx => {
                            if (args.marActivatedOrgsListed) {
                                let org = await Store.Organization.findById(_ctx, o.id);
                                let editorial = await Store.OrganizationEditorial.findById(_ctx, o.id);

                                if (!org || !editorial) {
                                    return;
                                }
                                if (org.status === 'activated') {
                                    editorial.listed = true;
                                }
                                await editorial.flush(ctx);
                                await Modules.Orgs.markForUndexing(_ctx, o.id);
                            } else {
                                let org = await Store.Organization.findById(_ctx, o.id);
                                if (!org) {
                                    return;
                                }
                                await Modules.Orgs.markForUndexing(_ctx, o.id);
                            }
                        });

                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                    } catch (e) {
                        await log('error: ' + e);
                    }
                    i++;
                }
                return 'done';
            });
            return true;
        }),
        debugCalcRoomsActiveMembers: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'debugCalcRoomsActiveMembers', async (log) => {
                let allRooms = await Store.RoomProfile.findAll(rootCtx);
                let i = 0;
                for (let room of allRooms) {
                    await inTx(rootCtx, async (ctx) => {
                        let activeMembers = await Store.RoomParticipant.active.findAll(ctx, room.id);
                        let _room = await Store.RoomProfile.findById(ctx, room.id);

                        if (_room) {
                            _room.activeMembersCount = activeMembers.length;
                        }
                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                        i++;
                    });
                }
                return 'done, total: ' + i;
            });
            return true;
        }),
        debugCalcOrgsActiveMembers: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'debugCalcOrgsActiveMembers', async (log) => {
                let allOrgs = await Store.Organization.findAll(rootCtx);
                let i = 0;
                for (let org of allOrgs) {
                    await inTx(rootCtx, async (ctx) => {
                        let activeMembers = await Modules.Orgs.findOrganizationMembers(ctx, org.id);
                        let _org = await Store.OrganizationProfile.findById(ctx, org.id);

                        if (_org) {
                            _org.joinedMembersCount = activeMembers.length;
                            await Modules.Orgs.markForUndexing(ctx, _org.id);
                        }
                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                        i++;
                    });
                }
                return 'done, total: ' + i;
            });
            return true;
        }),
        debugCreateCommentSubscriptions: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'debugCreateCommentSubscriptions', async (log) => {
                let allComments = await Store.Comment.findAll(rootCtx);
                let i = 0;
                for (let comment of allComments) {
                    await inTx(rootCtx, async (ctx) => {
                        let subscription = await Store.CommentsSubscription.findById(ctx, comment.peerType, comment.peerId, comment.uid);
                        if (!subscription) {
                            await Store.CommentsSubscription.create(ctx, comment.peerType, comment.peerId, comment.uid, {
                                status: 'active',
                                kind: 'all',
                            });
                        }
                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                        i++;
                    });
                }
                return 'done, total: ' + i;
            });
            return true;
        }),
        debugDeveloperInit: withUser(async (root, args, uid) => {
            if (process.env.NODE_ENV === 'production') {
                return false;
            }
            await inTx(root, async ctx => {
                await Modules.Users.activateUser(ctx, uid, false);
                await Modules.Orgs.createOrganization(ctx, uid, {name: 'Openland'});
                await Modules.Super.makeSuperAdmin(ctx, uid, 'super-admin');
            });
            return true;
        }),
        debugResetAudienceCounter: withPermission('super-admin', async (parent, args) => {
            await inTx(parent, async ctx => {
                await Store.UserAudienceCounter.set(ctx, (args.uid ? IDs.User.parse(args.uid) : parent.auth.uid!), 0);
            });
            return true;
        }),
        debugCalcUsersAudienceCounter: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'debugCalcUsersAudienceCounter', async (log) => {
                let allUsers = await Store.User.findAll(rootCtx);
                let i = 0;

                const calculateForUser = async (ctx: Context, uid: number) => {
                    let audience = 0;
                    let all = await Modules.Messaging.findUserDialogs(ctx, uid);

                    for (let a of all) {
                        let chat = await Store.Conversation.findById(ctx, a.cid);
                        if (!chat || chat.kind !== 'room') {
                            continue;
                        }
                        let room = (await Store.ConversationRoom.findById(ctx, a.cid))!;
                        if (room.kind !== 'public' || !room.oid) {
                            continue;
                        }
                        let org = await Store.Organization.findById(ctx, room.oid);
                        if (!org || org.kind !== 'community') {
                            continue;
                        }
                        let members = await Store.RoomParticipant.active.findAll(ctx, chat.id);
                        audience += members.length;
                    }
                    await Store.UserAudienceCounter.set(ctx, uid, audience);
                };

                for (let user of allUsers) {
                    await inTx(rootCtx, async (ctx) => {
                        await calculateForUser(ctx, user.id);
                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                        i++;
                    });
                }
                return 'done, total: ' + i;
            });
            return true;
        }),
        debugCalcUsers2WayDirectChatsCounter: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugCalcUsers2WayDirectChatsCounter', async (ctx, uid, log) => {
                let all = await Modules.Messaging.findUserDialogs(ctx, uid);
                let direct2wayChatsCount = 0;

                for (let dialog of all) {
                    let chat = await Store.Conversation.findById(ctx, dialog.cid);
                    if (!chat || chat.kind !== 'private') {
                        continue;
                    }
                    let messages = await Store.Message.chat.findAll(ctx, dialog.cid);

                    let sentCount = 0;
                    let receivedCount = 0;

                    for (let msg of messages) {
                        if (receivedCount > 0 && sentCount > 0) {
                            break;
                        } else if (msg.uid === uid) {
                            sentCount++;
                        } else {
                            receivedCount++;
                        }
                    }

                    if (receivedCount > 0 && receivedCount > 0) {
                        direct2wayChatsCount++;
                    }
                    await Store.UserMessagesSentInDirectChatCounter.set(ctx, uid, dialog.cid, sentCount);
                }
                await Store.User2WayDirectChatsCounter.set(ctx, uid, direct2wayChatsCount);
            });
            return true;
        }),
        debugCalcUsersChatsStats: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugCalcUsersChatsStats', async (ctx, uid, log) => {
                let all = await Modules.Messaging.findUserDialogs(ctx, uid);
                let chatsCount = 0;
                let directChatsCount = 0;

                for (let a of all) {
                    let conv = (await Store.Conversation.findById(ctx, a.cid))!;
                    if (!conv) {
                        continue;
                    }

                    chatsCount++;
                    if (conv.kind === 'private') {
                        directChatsCount++;
                    }
                }

                await Store.UserMessagesChatsCounter.byId(uid).set(ctx, chatsCount);
                await Store.UserMessagesDirectChatsCounter.byId(uid).set(ctx, directChatsCount);
            });
            return true;
        }),
        debugFixMessage: withPermission('super-admin', async (parent, args) => {
            let mid = args.id;
            await inTx(parent, async ctx => {
                let message = await Store.Message.findById(ctx, mid);
                if (!message) {
                    return;
                }
                if (message.spans) {
                    message.spans = [...(message.spans.filter((s: any) => s.type !== 'date_text'))];
                }
                await message.flush(ctx);
            });

            return true;
        }),
        debugEnableNotificationCenterForAll: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugEnableNotificationCenterForAll', async (ctx, uid, log) => {
                let settings = await Store.UserSettings.findById(ctx, uid);
                if (!settings) {
                    return;
                }

                if (!settings.commentNotifications) {
                    settings.commentNotifications = 'all';
                }
                if (!settings.commentNotificationsDelivery) {
                    settings.commentNotificationsDelivery = 'all';
                }
            });
            return true;
        }),
        debugResetGlobalCounters: withUser(async (parent, args, uid) => {
            await inTx(parent, async ctx => {
                let directory = Store.UserCountersIndexDirectory
                    .withKeyEncoding(encoders.tuple)
                    .withValueEncoding(encoders.int32LE);
                directory.clearPrefixed(ctx, [uid]);
            });
            return true;
        }),
        debugCalcGlobalCountersForAll: withPermission('super-admin', async (parent, args) => {
            let directory = Store.UserCountersIndexDirectory
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.int32LE);

            const calcForChat = async (ctx: Context, uid: number, cid: number) => {
                let unread = await Store.UserDialogCounter.get(ctx, uid, cid);
                let isMuted = await isChatMuted(ctx, uid, cid);
                if (unread > 0) {
                    directory.set(ctx, [uid, isMuted ? 'muted' : 'unmuted', cid], unread);
                }
            };

            debugTaskForAll(Store.User, parent.auth.uid!, 'debugCalcGlobalCountersForAll', async (ctx, uid, log) => {
                try {
                    let dialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                    directory.clearPrefixed(ctx, [uid]);

                    await Promise.all(dialogs.map(d => calcForChat(ctx, uid, d.cid)));
                } catch (e) {
                    await log(e);
                    logger.error(parent, 'debugCalcGlobalCountersForAllError', e);
                }
            });
            return true;
        }),
        debugValidateGlobalCountersForAll: withPermission('super-admin', async (parent, args) => {
            let directory = Store.UserCountersIndexDirectory
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.int32LE);

            debugTaskForAll(Store.User, parent.auth.uid!, 'debugValidateGlobalCountersForAll', async (ctx, uid, log) => {
                try {
                    let dialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                    await Promise.all(dialogs.map(async dialog => {
                        let chatUnread = await Store.UserDialogCounter.get(ctx, uid, dialog.cid);
                        let isMuted = await isChatMuted(ctx, uid, dialog.cid);

                        if (chatUnread < 0) {
                            await log(`[${uid}] negative dialog counter`);
                        }

                        if (chatUnread > 0) {
                            let counter = await directory.get(ctx, [uid, isMuted ? 'muted' : 'unmuted', dialog.cid]);
                            if (counter !== chatUnread) {
                                await log(`[${uid}], cid: ${dialog.cid}, value: ${counter} expected: ${chatUnread}, ${isMuted ? 'muted' : 'unmuted'}`);
                            }
                        } else {
                            let counter = await directory.get(ctx, [uid, isMuted ? 'muted' : 'unmuted', dialog.cid]);
                            if (counter) {
                                await log(`[${uid}] extra counter, cid: ${dialog.cid}, value: ${counter}`);
                            }
                        }
                    }));
                } catch (e) {
                    await log(e);
                    logger.error(parent, 'debugValidateGlobalCountersForAll', e);
                }
            });
            return true;
        }),
        debugQueueDailyEngagementReport: withPermission('super-admin', async (parent) => {
            await inTx(parent, async (ctx) => {
                await Modules.Stats.dailyEngagementQueue.pushImmediateWork(ctx);
            });

            return true;
        }),
        debugQueueDailyOnboardingReport: withPermission('super-admin', async (parent) => {
            await inTx(parent, async (ctx) => {
                await Modules.Stats.dailyOnboardingQueue.pushImmediateWork(ctx);
            });

            return true;
        }),
        debugQueueWeeklyOnboardingReport: withPermission('super-admin', async (parent) => {
            await inTx(parent, async (ctx) => {
                await Modules.Stats.weeklyOnboardingQueue.pushImmediateWork(ctx);
            });

            return true;
        }),
        debugQueueWeeklyEngagementReport: withPermission('super-admin', async (parent) => {
            await inTx(parent, async (ctx) => {
                await Modules.Stats.weeklyEngagementQueue.pushImmediateWork(ctx);
            });

            return true;
        }),
        debugCreateBigChat: withPermission('super-admin', async (parent, args) => {
            return inTx(parent, async ctx => {
                const randKey = () => (Math.random() * Math.pow(2, 55)).toString(16);
                let users: number[] = [];
                for (let i = 0; i <= args.membersCount; i++) {
                    let key = randKey();
                    let user = await Modules.Users.createUser(ctx, key, key + '@openland.com');
                    await Modules.Users.createUserProfile(ctx, user.id, {firstName: 'Test', lastName: '#' + key});
                    users.push(user.id);
                }
                await Modules.Messaging.room.createRoom(ctx, 'group', 1, parent.auth.uid!, users, {title: 'Test #' + randKey()});
                return true;
            });
        }),
        debugFlood: withPermission('super-admin', async (parent, args) => {
            return inTx(parent, async ctx => {
                const randKey = () => (Math.random() * Math.pow(2, 55)).toString(16);
                let start = Date.now();
                for (let i = 0; i <= args.messagesCount; i++) {
                    await Modules.Messaging.sendMessage(ctx, IDs.Conversation.parse(args.chat), parent.auth.uid!, {message: i + ' ' + randKey()});
                }
                logger.log(ctx, 'debugFlood took', Date.now() - start);
                return true;
            });
        }),
        debugReindexUserProfiles: withPermission('super-admin', async (parent) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugReindexUserProfiles', async (ctx, uid, log) => {
                await Modules.Users.markForUndexing(ctx, uid);
            });
            return true;
        }),
        debugReindexRoomProfiles: withPermission('super-admin', async (parent) => {
            debugTask(parent.auth.uid!, 'debugReindexRooms', async (log) => {
                let rooms = await Store.RoomProfile.findAll(parent);
                let i = 0;
                for (let r of rooms) {
                    try {
                        await inTx(parent, async ctx => {
                            await r.flush(ctx);
                        });

                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                    } catch (e) {
                        await log('error: ' + e);
                    }
                    i++;
                }
                return 'done';
            });
            return true;
        }),
        debugQueueWeeklyUserLeaderboard: withPermission('super-admin', async (parent) => {
            await inTx(parent, async (ctx) => {
                await Modules.Stats.weeklyUserLeaderboardQueue.pushImmediateWork(ctx);
            });

            return true;
        }),
        debugQueueWeeklyRoomLeaderboard: withPermission('super-admin', async (parent) => {
            await inTx(parent, async (ctx) => {
                await Modules.Stats.weeklyRoomLeaderboardQueue.pushImmediateWork(ctx);
            });

            return true;
        }),
        debugQueueWeeklyRoomByMessagesLeaderboard: withPermission('super-admin', async (parent) => {
            await inTx(parent, async (ctx) => {
                await Modules.Stats.weeklyRoomByMessagesLeaderboardQueue.pushImmediateWork(ctx);
            });

            return true;
        }),
        debugSendPush: withPermission('super-admin', async (parent, args) => {
            await inTx(parent, async (ctx) => {
                let uid = IDs.User.parse(args.id);
                await Modules.Push.pushWork(ctx, {
                    uid,
                    body: args.message,
                    title: 'test',
                    conversationId: 2,
                    counter: 0,
                    desktop: true,
                    mobile: true,
                    mobileAlert: true,
                    mobileIncludeText: true,
                    picture: null,
                    silent: null
                });
            });
            return true;
        }),
        debugReindexPrivateDialogs: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.ConversationPrivate, parent.auth.uid!, 'debugReindexPrivateDialogs', async (ctx, id, log) => {
                let dialog = await Store.ConversationPrivate.findById(ctx, id);
                dialog!.invalidate();
                await dialog!.flush(ctx);
            });
            return true;
        }),
        debugReindexUsersDialogs: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugReindexUsersDialogs', async (ctx, uid, log) => {
                let dialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                for (let dialog of dialogs) {
                    Store.DialogIndexEventStore.post(ctx, DialogNeedReindexEvent.create({uid, cid: dialog.cid}));
                }
            });
            return true;
        }),
        debugReindexFeedEvents: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.FeedEvent, parent.auth.uid!, 'debugReindexFeedEvents', async (ctx, id, log) => {
                let event = await Store.FeedEvent.findById(ctx, id);
                event!.invalidate();
                await event!.flush(ctx);
            });
            return true;
        }),
        debugChangeUserEmail: withPermission('super-admin', async (parent, args) => {
            return inTx(parent, async ctx => {
                let user = await Store.User.findById(ctx, IDs.User.parse(args.uid));
                if (!user) {
                    return false;
                }
                user.email = args.email;
                await user.flush(ctx);
                return true;
            });
        }),
        debugSwapUserEmails: withPermission('super-admin', async (parent, args) => {
            return inTx(parent, async ctx => {
                let user1 = await Store.User.findById(ctx, IDs.User.parse(args.uid1));
                if (!user1) {
                    return false;
                }
                let user2 = await Store.User.findById(ctx, IDs.User.parse(args.uid2));
                if (!user2) {
                    return false;
                }
                let profile1 = await Store.UserProfile.findById(ctx, IDs.User.parse(args.uid1));
                if (!profile1) {
                    return false;
                }
                let profile2 = await Store.UserProfile.findById(ctx, IDs.User.parse(args.uid2));
                if (!profile2) {
                    return false;
                }

                let email1 = user1.email;
                let email2 = user2.email;

                user1.email = email2;
                user2.email = email1;

                let profile1Email =  profile1.email;
                let profile2Email =  profile2.email;

                profile1.email = profile2Email;
                profile2.email = profile1Email;

                await user1.flush(ctx);
                await user2.flush(ctx);
                await profile1.flush(ctx);
                await profile2.flush(ctx);

                return true;
            });
        }),
        debugFindUsefulCommunities: withPermission('super-admin', async (ctx, args) => {
            let communities = await Store.Organization.community.findAll(ctx);

            let message = [heading('Top communities with 5+ members and 1 or more chats'), '\n'];
            let result: OrganizationProfile[] = [];
            for (let community of communities) {
                let profile = await Store.OrganizationProfile.findById(ctx, community.id);
                let chats = await Store.ConversationRoom.organizationPublicRooms.findAll(ctx, community.id);
                if (profile && profile.joinedMembersCount && profile.joinedMembersCount >= 5 && chats.length >= 1) {
                    result.push(profile);
                }
            }

            message = message.concat(result.sort((a, b) => a.joinedMembersCount! - b.joinedMembersCount!)
                .map(a => `${a.name} openland.com/${IDs.Organization.serialize(a.id)}\n`));

            let botId = await Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
            if (botId) {
                let cid = await Modules.Messaging.room.resolvePrivateChat(ctx, botId, ctx.auth.uid!);
                await Modules.Messaging.sendMessage(ctx, cid.id, botId!, buildMessage(...message));
            }

            return true;
        }),
        debugFixStickerPack: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                let pid = IDs.StickerPack.parse(args.id);

                let pack = await Store.StickerPack.findById(ctx, pid);
                if (!pack) {
                    return null;
                }

                let user = AuthContext.get(ctx);
                let stickers = await Store.Sticker.pack.findAll(ctx, pid);

                await Promise.all(stickers.map(a => Modules.Stickers.removeSticker(ctx, user.uid!, a.id)));
                await Promise.all(args.stickers.map(a => Modules.Stickers.addSticker(ctx, user.uid!, pid, a)));

                return pid;
            });
        }),
        debugReverseStickers: withPermission('super-admin', async (parent) => {
            await inTx(parent, async ctx => {
                let userStickers = await Store.UserStickersState.findAll(ctx);
                for (let us of userStickers) {
                    us.packIds = [...us.packIds.reverse()];
                    us.favoriteIds = [...us.favoriteIds.reverse()];

                    await us.invalidate();
                    await us.flush(ctx);
                }
            });
            return true;
        }),
        debugReindexShortnames: withPermission('super-admin', async (parent) => {
            debugTask(parent.auth.uid!, 'debugReindexShortnames', async (log) => {
                let allRecords = await inTx(rootCtx, async ctx => await Store.ShortnameReservation.findAll(ctx));
                let i = 0;

                for (let record of allRecords) {
                    await inTx(rootCtx, async (ctx) => {
                        let shortname = await Store.ShortnameReservation.findById(ctx, record.shortname);
                        shortname!.invalidate();
                        await shortname!.flush(ctx);
                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                        i++;
                    });
                }
                return 'done, total: ' + i;
            });
            return true;
        }),
        debugFixHyperlogEvent: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                let event = await Store.HyperLog.findById(ctx, args.eventId);
                if (!event) {
                    return false;
                }
                if (event.body && event.body.args && (typeof event.body.args !== 'object' || Array.isArray(event.body.args) || Object.keys(event.body.args).length === 0)) {
                    event.body = {...event.body, args: undefined};
                }
                for (let key of Object.keys(event.body.args)) {
                    let val = event.body.args[key];
                    if (typeof val === 'object' && Object.keys(val).length === 0) {
                        delete event.body.args[key];
                    }
                }
                if (event.body && event.body.args && Object.keys(event.body.args).length === 0) {
                    event.body = {...event.body, args: undefined};
                }

                await event.flush(ctx);
                return true;
            });
        }),
        debugReindexFeedChannelAdmins: withPermission('super-admin', async (parent) => {
            debugTask(parent.auth.uid!, 'debugReindexFeedChannelAdmins', async (log) => {
                let allRecords = await inTx(rootCtx, async ctx => await Store.FeedChannelAdmin.findAll(ctx));
                let i = 0;

                for (let record of allRecords) {
                    await inTx(rootCtx, async (ctx) => {
                        let admin = await Store.FeedChannelAdmin.findById(ctx, record.channelId, record.uid);
                        admin!.invalidate();
                        await admin!.flush(ctx);
                        if ((i % 100) === 0) {
                            await log('done: ' + i);
                        }
                        i++;
                    });
                }
                return 'done, total: ' + i;
            });
            return true;
        }),
        debugReindexFeedChannels: withPermission('super-admin', async (parent) => {
            debugTaskForAll(Store.FeedChannel, parent.auth.uid!, 'debugReindexFeedChannels', async (ctx, id, log) => {
                await Modules.Feed.markChannelForIndexing(ctx, id);
            });
            return true;
        }),
        debugReindexFeedTopics: withPermission('super-admin', async (parent) => {
            debugTaskForAll(Store.FeedTopic, parent.auth.uid!, 'debugReindexFeedTopics', async (ctx, id, log) => {
                let topic = await Store.FeedTopic.findById(ctx, id);
                topic!.invalidate();
                await topic!.flush(ctx);
            });
            return true;
        }),
        debugCalcChannelPostsCount: withPermission('super-admin', async (parent) => {
            debugTaskForAll(Store.FeedChannel, parent.auth.uid!, 'debugReindexFeedChannels', async (ctx, id, log) => {
                let topic = await Modules.Feed.resolveTopic(ctx, 'channel-' + id);
                let posts = await Store.FeedEvent.fromTopic.findAll(ctx, topic.id);
                await Store.FeedChannelPostsCount.set(ctx, id, posts.length);
            });
            return true;
        }),
        debugCalcChannelsSubscribersCount: withPermission('super-admin', async (parent) => {
            debugTaskForAll(Store.FeedChannel, parent.auth.uid!, 'debugCalcChannelsSubscribersCount', async (ctx, id, log) => {
                let topic = await Modules.Feed.resolveTopic(ctx, 'channel-' + id);
                let subscribers = await Store.FeedSubscription.topic.findAll(ctx, topic.id);
                await Store.FeedChannelMembersCount.set(ctx, id, subscribers.filter(s => s.enabled).length);
            });
            return true;
        }),
        debugResetUrlInfoFreshness: withPermission('super-admin', async (parent) => {
            await Modules.Super.setEnvVar(parent, 'url-info-freshness-threshold', Date.now());
            return true;
        }),
        debugFixUsersPrimaryOrganization: withPermission('super-admin', async (parent) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugFixUsersPrimaryOrganization', async (ctx, id, log) => {
                let profile = await Store.UserProfile.findById(ctx, id);
                if (profile && !profile.primaryOrganization) {
                    profile.primaryOrganization = await Modules.Orgs.findPrimaryOrganizationForUser(ctx, id);
                    if (!profile.primaryOrganization) {
                        await log(`user[${id}] org not found`);
                    }
                }
            });
            return true;
        }),
        debugResetPushDelivery: withPermission('super-admin', async (parent) => {
            return inTx(parent, async ctx => {
                let unreadUsers = await Modules.Messaging.needNotificationDelivery.findAllUsersWithNotifications(ctx, 'push');
                await Promise.all(unreadUsers.map(u => Modules.Messaging.needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', u)));
                return true;
            });
        }),
        debugAddStickerPackToAll: withPermission('super-admin', async (parent, args) => {
            let pid = IDs.StickerPack.parse(args.packId);
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugAddStickerPackToAll', async (ctx, id) => {
                await Modules.Stickers.addToCollection(ctx, id, pid);
            });
            return true;
        }),
        debugReplaceCommunityForChat: withPermission('super-admin', async (parent, args) => {
            let cid = IDs.Conversation.parse(args.chatId);
            let oid = IDs.Organization.parse(args.newCommunityId);

            return inTx(parent, async ctx => {
               let conv = await Store.ConversationRoom.findById(ctx, cid);
               conv!.oid = oid;
               await conv!.flush(ctx);
               return true;
            });
        })
    },
    Subscription: {
        debugEvents: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionDebugEventsArgs, ctx: AppContext) {
                let uid = ctx.auth.uid;

                if (!uid || !((await Modules.Super.superRole(ctx, uid)) === 'super-admin')) {
                    throw new AccessDeniedError();
                }

                // tslint:disable-next-line:no-floating-promises
                (async () => {
                    for (let i = 0; i < args.eventsCount; i++) {
                        // tslint:disable-next-line:no-floating-promises
                        (async () => {
                            if (args.randomDelays) {
                                await delay(randomInt(0, 10000));
                            }
                            await createDebugEvent(rootCtx, uid!, args.seed + ':' + i.toString(10));
                        })();
                    }
                })();

                let generator = Store.DebugEvent.user.liveStream(ctx, uid, {
                    batchSize: 20,
                    after: args.fromState || undefined
                });

                for await (let event of generator) {
                    for (let item of event.items) {
                        yield item;
                    }
                }
            },
        },
        lifecheck: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionDebugEventsArgs, ctx: AppContext) {
                let i = 1;
                while (true) {
                    let data = 'pong ' + Date.now() + ' ' + i++;
                    logger.log(ctx, 'send lifecheck', data);
                    yield data;
                    await delay(1000);
                }
            },
        },
        debugReaderState: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionDebugReaderStateArgs, ctx: AppContext) {
                let uid = ctx.auth.uid;

                if (!uid || !((await Modules.Super.superRole(ctx, uid)) === 'super-admin')) {
                    throw new AccessDeniedError();
                }

                let state = await Store.ReaderState.findById(ctx, args.reader);
                let prev = '';
                if (!state) {
                    throw new NotFoundError();
                }
                let key = encoders.tuple.unpack(Buffer.from(state!.cursor, 'hex'));
                let isDateBased = key.length === 2 && (typeof key[0] === 'number' && key[0]! > 1183028484169);

                while (true) {
                    state = await inTx(rootCtx, async ctx2 => await Store.ReaderState.findById(ctx2, args.reader));
                    let data = cursorToTuple(state!.cursor);
                    let str = isDateBased ? `createdAt: ${ddMMYYYYFormat(new Date(data[0] as any as number))}, id: ${data[1]}` : JSON.stringify(data);
                    if (str !== prev) {
                        yield str;
                        prev = str;
                    }
                    await delay(1000);
                }
            },
        },
        debugServerId: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionDebugEventsArgs, ctx: AppContext) {
                let uid = ctx.auth.uid;

                if (!uid || !((await Modules.Super.superRole(ctx, uid)) === 'super-admin')) {
                    throw new AccessDeniedError();
                }

                while (true) {
                    yield ServerId;
                    await delay(1000);
                }
            },
        },
    },
} as GQLResolver;
