import { Config } from 'openland-config/Config';
import {
    Organization,
    Message,
    Comment,
    DialogNeedReindexEvent,
    OrganizationProfile,
    OrganizationMemberShape,
    UserDialogCallStateChangedEvent,
    MessageShape,
    ShortnameReservationShape,
    UserShape, RoomParticipantShape,
} from './../openland-module-db/store';
import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withPermission, withUser } from '../openland-module-api/Resolvers';
import { Emails } from '../openland-module-email/Emails';
import { Store } from '../openland-module-db/FDB';
import { IDs, IdsFactory } from '../openland-module-api/IDs';
import { Modules } from '../openland-modules/Modules';
import { createUrlInfoService } from '../openland-module-messaging/workers/UrlInfoService';
import { inTx, encoders, TupleItem } from '@openland/foundationdb';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { ddMMYYYYFormat, delay } from '../openland-utils/timer';
import { randomInt, randomKey } from '../openland-utils/random';
import { debugSubspaceIterator, debugTask, debugTaskForAll, debugTaskForAllBatched } from '../openland-utils/debugTask';
import { Context, createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { cursorToTuple } from '@openland/foundationdb-entity/lib/indexes/utils';
import { buildMessage, heading } from '../openland-utils/MessageBuilder';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { SmsService } from '../openland-utils/sms/SmsService';
import uuid from 'uuid';
import { EntityFactory } from '@openland/foundationdb-entity';
import { findEntitiesCount } from '../openland-module-db/findEntitiesCount';
import { asyncRun } from '../openland-mtproto3/utils';
import { container } from '../openland-modules/Modules.container';
import { batch } from '../openland-utils/batch';
import { UserError } from '../openland-errors/UserError';
import { UserGroupsRepository } from '../openland-module-messaging/repositories/UserGroupsRepository';
import { MessageAttachmentFileInput, MessageSpan } from '../openland-module-messaging/MessageInput';
import { UserReadSeqsDirectory } from '../openland-module-messaging/repositories/UserReadSeqsDirectory';
import fetch from 'node-fetch';
import { CacheRepository } from '../openland-module-cache/CacheRepository';

const URLInfoService = createUrlInfoService();
const rootCtx = createNamedContext('resolver-debug');
const logger = createLogger('debug');

const nextDebugSeq = async (ctx: Context, uid: number) => {
    let state = await Store.DebugEventState.findById(ctx, uid!);
    if (!state) {
        await Store.DebugEventState.create(ctx, uid!, { seq: 1 });
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
        await Store.DebugEvent.create(ctx, uid!, seq, { key });
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

async function sendSuperNotification(root: Context, uid: number, message: string) {
    await inTx(root, async ctx => {
        let superNotificationsAppId = await Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
        let conv = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, superNotificationsAppId!);
        await Modules.Messaging.sendMessage(
            ctx,
            conv.id,
            superNotificationsAppId!,
            { message },
            true
        );
    });
}

export const Resolver: GQLResolver = {
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
        key: src => src.key || '',
    },
    GqlTrace: {
        id: src => IDs.GqlTrace.serialize(src.id),
        name: src => src.traceData.name,
        duration: src => src.traceData.duration,
        traceData: src => JSON.stringify(src.traceData),
        date: src => src.metadata.createdAt
    },
    GqlTraceConnection: {
        items: src => src.items,
        cursor: src => src.cursor || null
    },
    Query: {
        debugGlobalCounter: withPermission('super-admin', async (ctx, args) => {
            let id = ctx.auth.uid!;
            return {
                all: await Modules.Messaging.messaging.counters.getGlobalCounter(ctx, id, false, 'all'),
                mentions: await Modules.Messaging.messaging.counters.getGlobalCounter(ctx, id, false, 'all-mentions')
            };
        }),
        debugChatCounter: withPermission('super-admin', async (ctx, args) => {
            let id = ctx.auth.uid!;
            let cid = IDs.Conversation.parse(args.id);
            let debug = await Modules.Messaging.messaging.counters.getDebugCounter(ctx, id, cid);
            return {
                all: await Modules.Messaging.messaging.counters.getLocalCounter(ctx, id, cid, 'all'),
                mentions: await Modules.Messaging.messaging.counters.getLocalCounter(ctx, id, cid, 'mentions'),
                ...debug!.debug
            };
        }),
        debugChatState: withPermission('super-admin', async (ctx, args) => {
            let id = ctx.auth.uid!;
            let cid = IDs.Conversation.parse(args.id);
            return (await Modules.Messaging.messaging.counters.subscribers.readState(ctx, { cid, uid: id }));
        }),
        debugChatTree: withPermission('super-admin', async (ctx, args) => {
            let cid = IDs.Conversation.parse(args.id);
            return JSON.stringify((await Modules.Messaging.messaging.counters.counters.counting.btree.ops.dumpAll(ctx, encoders.tuple.pack([cid, 0]))));
        }),
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
            return await URLInfoService.fetchURLInfo(args.url, false);
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
            let tail = await Store.DebugEvent.user.stream(ctx.auth.uid!, { batchSize: 1 }).tail(ctx);
            return { state: tail || '' };
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
        debugServerId: withUser(async (ctx, args, uid) => {
            return ServerId;
        }),
        debugGqlTraces: withPermission('super-admin', async (ctx, args) => {
            let afterId = args.after ? IDs.GqlTrace.parse(args.after) : null;
            if (!args.first || args.first <= 0) {
                return { items: [], cursor: undefined };
            }
            let afterExists = afterId && await Store.GqlTrace.findById(ctx, afterId);
            let { items, haveMore } = await Store.GqlTrace.trace.query(ctx, {
                limit: args.first,
                after: afterExists ? afterId : undefined,
                reverse: true
            });
            return {
                items,
                cursor: haveMore ? IDs.GqlTrace.serialize(items[items.length - 1].id) : undefined
            };
        }),
        debugGqlTrace: withPermission('super-admin', async (ctx, args) => {
            let id = IDs.GqlTrace.parse(args.id);
            return (await Store.GqlTrace.findById(ctx, id))!;
        }),
        debugUserWallet: withPermission('super-admin', async (ctx, args) => {
            let uid = IDs.User.parse(args.id);
            return await Modules.Wallet.getWallet(ctx, uid);
        }),
        debugEntitiesCounter: withPermission('super-admin', async (ctx, args) => {
            let state = await Store.EntityCounterState.findById(ctx, args.name);
            if (state) {
                return state.count;
            }
            return 0;
        }),
        debugEntitiesCleanerProgress: withPermission('super-admin', async (ctx, args) => {
            let state = await Store.EntityCleanerState.findById(ctx, args.name);
            if (state) {
                return state.deletedCount;
            }
            return 0;
        }),
        debugUserSearch: withPermission('super-admin', async (ctx, args) => {
            let hits = await Modules.Search.elastic.client.search({
                index: 'user_profile',
                type: 'user_profile',
                size: 100,
                body: JSON.parse(args.query),
            });
            return JSON.stringify(hits.hits.hits);
        }),
        debugMentionSearch: withPermission('super-admin', async (ctx, args) => {
            let hits = await Modules.Search.elastic.client.search({
                index: args.index.replace('message', ''),
                size: args.first,
                body: JSON.parse(args.query),
            });
            return JSON.stringify(hits.hits.hits);
        }),
        debugMentionSearchGetUserData: withPermission('super-admin', async (ctx, args) => {
            let cid = IDs.Conversation.parse(args.cid);
            let userOrgs = await Modules.Orgs.findUserOrganizations(ctx, ctx.auth.uid!);
            let room = await Store.ConversationRoom.findById(ctx, cid);
            let roomOid: null | number = room ? room.oid : null;
            let [topPrivateDialogs, topGroupDialogs] = await Promise.all([
                Store.UserEdge.forwardWeight.query(ctx, ctx.auth.uid!, { limit: 300, reverse: true }),
                Store.UserGroupEdge.user.query(ctx, ctx.auth.uid!, { limit: 300, reverse: true })
            ]);
            return JSON.stringify({
                topPrivateDialogs: topPrivateDialogs.items.map(d => ({ uid1: d.uid1, uid2: d.uid2, weight: d.weight })),
                topGroupDialogs: topGroupDialogs.items.map(d => ({ cid: d.cid, weight: d.weight })),
                userOrgs,
                roomOid,
                cid
            });
        }),
        debugGetCounters: withPermission('super-admin', async (ctx, args) => {
            return JSON.stringify(await Modules.Messaging.counters.fetchUserCounters(ctx, ctx.auth.uid!));
        }),
        debugExperimentalCounter: withPermission('super-admin', async (ctx, args) => {
            // let counters = new ExperimentalCountersRepository();
            // let cid = IDs.Conversation.parse(args.cid);
            // let uid = ctx.auth.uid!;
            //
            // let userReadSeq = await counters.userReadSeqsSubspace.get(ctx, [uid, cid]);
            // let messages = await counters.messages.get(ctx, cid, userReadSeq! + 1);
            // let messagesFiltered = messages.filter(m => m.uid !== uid && !m.hiddenFor.includes(uid));
            // let unreadCounter = messages.length;
            // let chatLastSeq = await Store.ConversationLastSeq.byId(cid).get(ctx);
            //
            // return JSON.stringify({
            //     cid,
            //     uid,
            //     chatLastSeq,
            //     userReadSeq,
            //     messages,
            //     messagesFiltered,
            //     unreadCounter
            // });
            return 'ok';
        }),
        debugFindUser: withPermission('super-admin', async (ctx, args) => {
            if (args.email) {
                return await Store.User.email.find(ctx, args.email);
            } else if (args.phone) {
                return await Store.User.fromPhone.find(ctx, args.phone);
            } else {
                return null;
            }
        }),
        debugSocialSharingImage: withPermission('super-admin', async (ctx, args) => {
            let res = await fetch(Config.screenshotter + '/render', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    template: args.template,
                    args: {
                        title: args.title,
                        image: args.image,
                        subTitle: args.subTitle
                    }
                })
            });
            if (res.status !== 200) {
                throw new UserError('Error in screenshor');
            }
            let json = await res.json();
            return JSON.stringify(json);
        }),
    },
    Mutation: {
        debugSendSMS: withPermission('super-admin', async (ctx, args) => {
            await SmsService.sendSms(ctx, args.to, args.message);
            return true;
        }),
        lifecheck: () => `i'm still ok`,
        debugSendEmail: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                let uid = ctx.auth.uid!;
                let oid = ctx.auth.oid!;
                let type = args.type;
                let user = await Store.User.findById(ctx, uid);
                let email = user!.email!;
                let isProd = Config.environment === 'production';

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
                    let messages = await Store.Message.chat.query(ctx, dialog.cid, { limit: 1, reverse: true });

                    await Emails.sendUnreadMessages(ctx, uid, messages.items);
                } else if (type === 'UNREAD_MESSAGES') {
                    let dialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                    let messages: Message[] = [];

                    for (let dialog of dialogs) {
                        let msgs = await Store.Message.chat.query(ctx, dialog.cid, { limit: 1, reverse: true });
                        messages.push(msgs.items[0]);
                    }

                    await Emails.sendUnreadMessages(ctx, uid, messages);
                } else if (type === 'PUBLIC_ROOM_INVITE') {
                    let cid = IDs.Conversation.parse(isProd ? 'AL1ZPXB9Y0iq3yp4rx03cvMk9d' : 'd5z2ppJy6JSXx4OA00lxSJXmp6');

                    await Emails.sendRoomInviteEmail(ctx, uid, email, cid, { id: 'xxxxx' } as any);
                } else if (type === 'PRIVATE_ROOM_INVITE') {
                    let cid = IDs.Conversation.parse(isProd ? 'qljZr9WbMKSRlBZWbDo5U9qZW4' : 'vBDpxxEQREhQyOBB6l7LUDMwPE');

                    await Emails.sendRoomInviteEmail(ctx, uid, email, cid, { id: 'xxxxx' } as any);
                } else if (type === 'ROOM_INVITE_ACCEPTED') {
                    let cid = IDs.Conversation.parse(isProd ? 'AL1ZPXB9Y0iq3yp4rx03cvMk9d' : 'd5z2ppJy6JSXx4OA00lxSJXmp6');

                    let invite = {
                        creatorId: uid,
                        channelId: cid,
                    };

                    await Emails.sendRoomInviteAcceptedEmail(ctx, uid, invite as any);
                } else if (type === 'WEEKLY_DIGEST') {
                    await Emails.sendWeeklyDigestEmail(ctx, uid);
                } else if (type === 'GENERIC') {
                    await Emails.sendGenericEmail(ctx, uid, {
                        subject: 'Generic subject',
                        title: 'Generic title',
                        text: 'Generic text',
                        link: 'https://openland.com/',
                        buttonText: 'Button caption'
                    });
                }

                return true;
            });
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
                return (await Store.User.findById(ctx, id))!;
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
            throw new UserError('Deprecated');
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

                    return { totalSent, totalReceived, totalSentDirect };
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
                            let { totalSent, totalReceived, totalSentDirect } = await calculateForUser(ctx, user.id);

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
                Store.RoomParticipantsVersion.increment(ctx, chat.id);

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
                        // let activeMembers = await Store.RoomParticipant.active.findAll(ctx, room.id);
                        let activeMembers = await Modules.Messaging.room.findConversationMembers(ctx, room.id);
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
            if (Config.environment === 'production') {
                return false;
            }
            await inTx(root, async ctx => {
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

            let userMuteSettingsSubspace = Store.UserDialogMuteSettingDirectory
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.boolean);

            let dialogCountersDirectory = Store.UserDialogCounter.directory
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.int32LE);

            debugTaskForAll(Store.User, parent.auth.uid!, 'debugCalcGlobalCountersForAll', async (ctx, uid, log) => {
                try {
                    let dialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                    let mutedChatsData = await userMuteSettingsSubspace.range(ctx, [uid]);
                    let dialogCountersData = await dialogCountersDirectory.range(ctx, [uid]);

                    let mutedChats = new Set<number>(mutedChatsData.filter(v => v.value).map(v => v.key[1] as number));
                    let dialogCounters = new Map<number, number>(dialogCountersData.map(v => ([v.key[1] as number, v.value])));

                    directory.clearPrefixed(ctx, [uid]);

                    for (let { cid } of dialogs) {
                        let isMuted = mutedChats.has(cid);
                        let unread = dialogCounters.get(cid) || 0;

                        if (unread > 0) {
                            directory.set(ctx, [uid, isMuted ? 'muted' : 'unmuted', cid], unread);
                        }
                    }
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
        debugCreateBigChat: withPermission('super-admin', async (parent, args) => {
            return inTx(parent, async ctx => {
                const randKey = () => (Math.random() * Math.pow(2, 55)).toString(16);
                let users: number[] = [];
                for (let i = 0; i <= args.membersCount; i++) {
                    let key = randKey();
                    let user = await Modules.Users.createUser(ctx, { email: key + '@openland.com' });
                    await Modules.Users.createUserProfile(ctx, user.id, { firstName: 'Test', lastName: '#' + key });
                    users.push(user.id);
                }
                await Modules.Messaging.room.createRoom(ctx, 'group', 1, parent.auth.uid!, users, { title: 'Test #' + randKey() });
                return true;
            });
        }),
        debugFlood: withPermission('super-admin', async (parent, args) => {
            return inTx(parent, async ctx => {
                const randKey = () => (Math.random() * Math.pow(2, 55)).toString(16);
                let start = Date.now();
                for (let i = 0; i <= args.messagesCount; i++) {
                    await Modules.Messaging.sendMessage(ctx, IDs.Conversation.parse(args.chat), parent.auth.uid!, { message: i + ' ' + randKey() });
                }
                logger.log(ctx, 'debugFlood took', Date.now() - start);
                return true;
            });
        }),
        debugReindexUserProfiles: withPermission('super-admin', async (parent) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugReindexUserProfiles', async (ctx, uid, log) => {
                await Modules.Users.markForIndexing(ctx, uid);
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
                            let room = await Store.RoomProfile.findById(ctx, r.id);
                            room!.invalidate();
                            await room!.flush(ctx);
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
        debugSendPush: withPermission('super-admin', async (parent, args) => {
            await inTx(parent, async (ctx) => {
                let uid = IDs.User.parse(args.id);
                await Modules.Push.pushWork(ctx, {
                    uid,
                    body: args.message,
                    title: 'test',
                    conversationId: 2,
                    deepLink: null,
                    counter: 0,
                    desktop: true,
                    mobile: true,
                    mobileAlert: true,
                    mobileIncludeText: true,
                    picture: null,
                    silent: null,
                    messageId: null,
                    commentId: null
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
                    Store.DialogIndexEventStore.post(ctx, DialogNeedReindexEvent.create({ uid, cid: dialog.cid }));
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

                let profile1Email = profile1.email;
                let profile2Email = profile2.email;

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
                    event.body = { ...event.body, args: undefined };
                }
                for (let key of Object.keys(event.body.args)) {
                    let val = event.body.args[key];
                    if (typeof val === 'object' && Object.keys(val).length === 0) {
                        delete event.body.args[key];
                    }
                }
                if (event.body && event.body.args && Object.keys(event.body.args).length === 0) {
                    event.body = { ...event.body, args: undefined };
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
            let defaultOrg = await Modules.Super.getEnvVar<string>(rootCtx, 'default-org-id');

            debugTaskForAll(Store.User, parent.auth.uid!, 'debugFixUsersPrimaryOrganization', async (ctx, id, log) => {
                let user = (await Store.User.findById(ctx, id))!;
                let profile = await Store.UserProfile.findById(ctx, id);
                if (!profile) {
                    return;
                }
                if (user.isBot) {
                    profile.primaryOrganization = null;
                    return;
                }
                if (profile.primaryOrganization) {
                    let org = await Store.Organization.findById(ctx, profile.primaryOrganization);
                    if (!org) {
                        await log(`user[${id}] invalid org`);
                        profile.primaryOrganization = await Modules.Orgs.findPrimaryOrganizationForUser(ctx, id);
                    }
                    if (org?.kind !== 'organization') {
                        await log(`user[${id}] not organization was set`);
                        profile.primaryOrganization = await Modules.Orgs.findPrimaryOrganizationForUser(ctx, id);
                    }
                }
                if (!profile.primaryOrganization) {
                    profile.primaryOrganization = await Modules.Orgs.findPrimaryOrganizationForUser(ctx, id);
                }

                if (!profile.primaryOrganization) {
                    if (!defaultOrg) {
                        await log(`user[${id}] org not found`);
                    } else {
                        try {
                            let orgId = IDs.Organization.parse(defaultOrg);
                            await Modules.Orgs.addUserToOrganization(ctx, id, orgId, id, true);
                            profile.primaryOrganization = orgId;
                            await log(`user[${id}] moved to default org`);
                        } catch (e) {
                            await log(e);
                            logger.error(rootCtx, e);
                        }
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
        }),
        debugRecountSeqForMessages: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'debugRecountSeqForMessages', async (log) => {
                let count = 0;
                let limit = 100;
                let total = 0;
                let seenChats = new Set<number>();
                try {
                    let stream = Store.Message.created.stream({ batchSize: limit });
                    do {
                        await inTx(parent, async ctx => {
                            let messages = await stream.next(ctx);
                            for (let message of messages) {
                                if (!seenChats.has(message.cid)) {
                                    await Store.ConversationLastSeq.byId(message.cid).set(ctx, 0);
                                    seenChats.add(message.cid);
                                }
                                Store.ConversationLastSeq.byId(message.cid).increment(ctx);
                                message.seq = await Store.ConversationLastSeq.byId(message.cid).get(ctx);
                            }
                            count = messages.length;
                            total += messages.length;
                        });
                        if (total % 10000 === 0) {
                            await log('Proceed ' + total + ' messages');
                        }
                    } while (count === limit && count > 0);
                } catch (e) {
                    return `failed ${e.message}`;
                }
                return 'ok';
            });
            return true;
        }),
        debugFixEditedMessagesAugmentation: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'debugFixEditedMessagesAugmentation', async (log) => {
                let count = 0;
                let limit = 100;
                let total = 0;
                let broken = 0;
                try {
                    let stream = Store.Message.updated.stream({ batchSize: limit });
                    do {
                        await inTx(parent, async ctx => {
                            let messages = await stream.next(ctx);
                            for (let message of messages) {
                                if (!message.attachmentsModern) {
                                    continue;
                                }
                                let attachments = message.attachmentsModern;
                                let links: string[] = [];
                                let fixedAttachments = [];
                                for (let a of attachments) {
                                    if (a.type === 'rich_attachment' && a.titleLink) {
                                        if (links.includes(a.titleLink)) {
                                            continue;
                                        }
                                        links.push(a.titleLink);
                                    }
                                    fixedAttachments.push(a);
                                }
                                if (fixedAttachments.length !== attachments.length) {
                                    broken++;
                                }
                                message.attachmentsModern = fixedAttachments;
                            }
                            count = messages.length;
                            total += messages.length;
                        });
                        if (total % 10000 === 0) {
                            await log('Proceed ' + total + ' messages, ' + broken + ' broken');
                        }
                    } while (count === limit && count > 0);
                    await log('Success: proceed ' + total + ' messages, ' + broken + ' broken');
                } catch (e) {
                    return `failed ${e.message}`;
                }
                return 'ok';
            });
            return true;
        }),
        debugReindexRoomMessagesCounter: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.ConversationRoom, parent.auth.uid!, 'debugReindexRoomMessagesCounter', async (ctx, cid, log) => {
                let hits = await Modules.Search.elastic.client.search({
                    index: 'message',
                    type: 'message',
                    size: 100,
                    body: {
                        sort: [{ createdAt: 'desc' }], query: { bool: { must: [{ term: { cid } }] } },
                    },
                });
                await Store.RoomMessagesCounter.set(ctx, cid, (hits.hits.total as any).value);
            });

            return true;
        }),
        // debugQueueDailyPaidLeaderboard: withPermission('super-admin', async (parent) => {
        //     await inTx(parent, async (ctx) => {
        //         await Modules.Stats.dailyPaidLeaderboardQueue.pushImmediateWork(ctx);
        //     });
        //
        //     return true;
        // }),
        // debugQueueWeeklyPaidLeaderboard: withPermission('super-admin', async (parent) => {
        //     await inTx(parent, async (ctx) => {
        //         await Modules.Stats.weeklyPaidLeaderboardQueue.pushImmediateWork(ctx);
        //     });
        //
        //     return true;
        // }),
        // debugQueueWeeklyUserLeaderboard: withPermission('super-admin', async (parent) => {
        //     await inTx(parent, async (ctx) => {
        //         await Modules.Stats.weeklyUserLeaderboardQueue.pushImmediateWork(ctx);
        //     });
        //
        //     return true;
        // }),
        // debugQueueWeeklyRoomLeaderboard: withPermission('super-admin', async (parent) => {
        //     await inTx(parent, async (ctx) => {
        //         await Modules.Stats.weeklyRoomLeaderboardQueue.pushImmediateWork(ctx);
        //     });
        //
        //     return true;
        // }),
        // debugQueueWeeklyRoomByMessagesLeaderboard: withPermission('super-admin', async (parent) => {
        //     await inTx(parent, async (ctx) => {
        //         await Modules.Stats.weeklyRoomByMessagesLeaderboardQueue.pushImmediateWork(ctx);
        //     });
        //
        //     return true;
        // }),
        // debugQueueDailyEngagementReport: withPermission('super-admin', async (parent) => {
        //     await inTx(parent, async (ctx) => {
        //         await Modules.Stats.dailyEngagementQueue.pushImmediateWork(ctx);
        //     });
        //
        //     return true;
        // }),
        // debugQueueDailyOnboardingReport: withPermission('super-admin', async (parent) => {
        //     await inTx(parent, async (ctx) => {
        //         await Modules.Stats.dailyOnboardingQueue.pushImmediateWork(ctx);
        //     });
        //
        //     return true;
        // }),
        // debugQueueWeeklyOnboardingReport: withPermission('super-admin', async (parent) => {
        //     await inTx(parent, async (ctx) => {
        //         await Modules.Stats.weeklyOnboardingQueue.pushImmediateWork(ctx);
        //     });
        //
        //     return true;
        // }),
        // debugQueueWeeklyEngagementReport: withPermission('super-admin', async (parent) => {
        //     await inTx(parent, async (ctx) => {
        //         await Modules.Stats.weeklyEngagementQueue.pushImmediateWork(ctx);
        //     });
        //
        //     return true;
        // }),
        debugSendHiddenMessage: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async (ctx) => {
                let dialog = await Modules.Messaging.room.resolvePrivateChat(ctx, parent.auth.uid!, IDs.User.parse(args.uid));
                await Modules.Messaging.sendMessage(ctx, dialog.id, parent.auth.uid!, {
                    message: args.message,
                    visibleOnlyForUids: [ctx.auth.uid!]
                    // hiddenForUids: [IDs.User.parse(args.uid)]
                });
                return true;
            });
        }),
        debugFixBrokenDonations: withPermission('super-admin', async (parent) => {
            await debugTask(parent.auth.uid!, 'fix-broken-donations', async (log) => {
                let purchasesWithMessage: { pid: string, mid: number }[] = [];
                await inTx(parent, async ctx => {
                    let messages = await Store.Message.updated.query(ctx, { reverse: true, limit: 50000 });
                    let total = 0;
                    for (let message of messages.items) {
                        if (!message.attachmentsModern) {
                            continue;
                        }

                        let purchaseAttachment = message.attachmentsModern!.find(a => a.type === 'purchase_attachment');
                        if (purchaseAttachment && purchaseAttachment.type === 'purchase_attachment') {
                            purchasesWithMessage.push({ pid: purchaseAttachment.pid, mid: message.id });
                            total += 1;
                        }
                    }
                    await log('found ' + total);
                });
                await inTx(parent, async ctx => {
                    for (let { pid, mid } of purchasesWithMessage) {
                        let purchase = await Store.WalletPurchase.findById(ctx, pid);
                        if (purchase && purchase.product.type === 'donate_message') {
                            await log('mid: ' + mid);
                            purchase.product = {
                                ...purchase.product,
                                mid,
                            };
                            await purchase.flush(ctx);
                        }
                    }
                });
                return 'success';
            });
            return true;
        }),
        debugCreateTransfer: withPermission('super-admin', async (parent, args) => {
            let fromUid = IDs.User.parse(args.fromUid);
            let toUid = IDs.User.parse(args.toUid);

            let retryKey = uuid();
            await Modules.Wallet.createTransferPayment(parent, fromUid, toUid, args.amount, retryKey);
            return retryKey;
        }),
        debugSetCommission: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                let cid = IDs.Conversation.parse(args.cid);
                let settings = await Store.PremiumChatSettings.findById(ctx, cid);
                if (!settings) {
                    return false;
                }
                if (args.percents > 100 || args.percents < 0) {
                    return false;
                }
                settings.commissionPercents = args.percents;
                await settings.flush(ctx);
                return true;
            });
        }),
        debugReindexUsers: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugReindexUsers', async (root, id) => {
                await inTx(root, async ctx => {
                    let user = await Store.User.findById(ctx, id);
                    if (!user) {
                        return;
                    }
                    user.invalidate();
                    await user.flush(ctx);
                });
            });
            return true;
        }),
        debugSetChatPayments: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                let cid = IDs.Conversation.parse(args.cid);
                let room = await Store.ConversationRoom.findById(ctx, cid);
                if (!room) {
                    throw new NotFoundError();
                }
                let settings = await Store.PremiumChatSettings.findById(ctx, cid);
                if (settings) {
                    settings.price = args.price;
                    settings.interval = args.interval === 'MONTH' ? 'month' : args.interval === 'WEEK' ? 'week' : null;
                }
                room.isPremium = args.price > 0;

                let profile = await Store.RoomProfile.findById(ctx, cid);
                profile!.invalidate();
                await profile!.flush(ctx);

                return true;
            });
        }),

        debugCalcEntitiesCount: withPermission('super-admin', async (ctx, args) => {
            let uid = ctx.auth.uid!;
            let entity = (Store as any)[args.entity];
            if (!(entity instanceof EntityFactory)) {
                throw new AccessDeniedError();
            }
            asyncRun(async () => {
                try {
                    let res = await findEntitiesCount(entity);
                    await sendSuperNotification(rootCtx, uid, `${args.entity} count: ${res}`);
                } catch (e) {
                    await sendSuperNotification(rootCtx, uid, `Error: ${e}`);
                }
            });

            return true;
        }),
        debugCalcEntitiesCountAll: withPermission('super-admin', async (ctx, args) => {
            let uid = ctx.auth.uid!;
            let res: { name: string, count: number }[] = [];

            asyncRun(async () => {
                for (let f in container.get('Store') as any) {
                    let entity = (Store as any)[f];
                    if (entity instanceof EntityFactory) {
                        let name = entity.descriptor.name;

                        if (
                            name === 'HyperLog' ||
                            name === 'Message' ||
                            name === 'Task' ||
                            name === 'DelayedTask'
                        ) {
                            continue;
                        }

                        let count = await findEntitiesCount(entity);
                        res.push({ name, count });
                        await sendSuperNotification(rootCtx, uid, `${entity.descriptor.name} count: ${count}`);
                    }
                }
                await sendSuperNotification(rootCtx, uid, JSON.stringify(res));
            });

            return true;
        }),
        debugSetRoomOwner: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                let cid = IDs.Conversation.parse(args.roomId);
                let uid = IDs.User.parse(args.owner);

                let room = await Store.ConversationRoom.findById(ctx, cid);
                if (!room) {
                    return false;
                }
                let member = await Store.RoomParticipant.findById(ctx, cid, uid);
                if (!member) {
                    return false;
                }
                room.ownerId = uid;
                await room.flush(ctx);

                return true;
            });
        }),
        debugClearSchedulerFromConferences: withPermission('super-admin', async (parent) => {
            await debugTaskForAll(Store.ConferenceRoom, parent.auth.uid!, 'apply-scheduler', async (ctx, id, log) => {
                let conf = await Store.ConferenceRoom.findById(ctx, id);
                conf!.scheduler = null;
            });
            return true;
        }),
        debugInvalidateAllMessages: withPermission('super-admin', async (parent) => {
            debugSubspaceIterator<MessageShape>(Store.Message.descriptor.subspace, parent.auth.uid!, 'debugInvalidateAllMessages', async (next, log) => {
                let res: { key: TupleItem[], value: MessageShape }[] = [];
                let total = 0;
                do {
                    res = await next(parent, 99);
                    total += res.length;

                    try {
                        await inTx(parent, async ctx => {
                            for (let msg of res) {
                                let message = await Store.Message.findById(ctx, msg.value.id);
                                message!.invalidate();
                            }
                        });
                        if (total % 9900 === 0) {
                            await log('done: ' + total);
                        }
                    } catch (e) {
                        await log('error: ' + e);
                    }
                } while (res.length > 0);

                return 'done, total: ' + total;
            });
            return true;
        }),
        debugFixUserSettings: withPermission('super-admin', async (parent) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugFixUserSettings', async (ctx, uid, log) => {
                let settings = await Store.UserSettings.findById(ctx, uid);
                if (!settings) {
                    return;
                }
                settings.privacy = {
                    whoCanSeeEmail: 'nobody',
                    whoCanSeePhone: 'nobody',
                    communityAdminsCanSeeContactInfo: true,
                    whoCanAddToGroups: 'everyone'
                };
                await settings.flush(ctx);
            });
            return true;
        }),
        debugFixDeletedRooms: withPermission('super-admin', async (parent) => {
            debugTaskForAll(Store.ConversationRoom, parent.auth.uid!, 'debugFixDeletedRooms', async (ctx, id, log) => {
                let conv = await Store.Conversation.findById(ctx, id);
                if (conv && conv.deleted) {
                    let room = await Store.ConversationRoom.findById(ctx, conv.id);
                    if (!room) {
                        return;
                    }
                    room.isDeleted = true;
                }
            });
            return true;
        }),
        debugUnsubscribeEveryoneFromChat: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                let canceled = 0;

                let cid = IDs.Conversation.parse(args.cid);
                let subs = await Store.RoomParticipant.active.findAll(ctx, cid);
                for (let sub of subs) {
                    let subscriptions = await Store.WalletSubscription.user.findAll(ctx, sub.uid);
                    let subscription = subscriptions.find(a => a.proudct.type === 'group' && a.proudct.gid === cid);
                    if (subscription && await Modules.Wallet.subscriptions.tryCancelSubscription(ctx, subscription.id)) {
                        canceled++;
                    }
                }
                return canceled;
            });
        }),
        debugInviteMembersFromChat: withPermission('super-admin', async (parent, args) => {
            let from = IDs.Conversation.parse(args.cid);
            let to = IDs.Conversation.parse(args.dest);
            debugTask(parent.auth.uid!, 'debugInviteMembersFromChat', async (log) => {
                let prevMembers = await inTx(parent, ctx => Modules.Messaging.room.findConversationMembers(ctx, from));
                let members = batch(prevMembers, 20);
                let total = 0;
                for (let b of members) {
                    await inTx(parent, async ctx => {
                        await Modules.Messaging.room.inviteToRoom(ctx, to, parent.auth.uid!, b);
                    });
                    total += b.length;
                    await log('Invited ' + total + ' members');
                }
                return 'ok';
            });
            return true;
        }),
        debugDeleteAllContacts: withPermission('super-admin', async (parent, args) => {
            await inTx(parent, async ctx => {
                let contacts = await Store.Contact.findAll(ctx);
                for (let c of contacts) {
                    await c.delete(ctx);
                }
            });
            return true;
        }),
        debugChangeGlobalCounterTypeForAll: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugCalcUsers2WayDirectChatsCounter', async (ctx, uid, log) => {
                let settings = await Store.UserSettings.findById(ctx, uid);
                if (!settings) {
                    return;
                }
                if (!settings.globalCounterType) {
                    settings.globalCounterType = 'unread_chats';
                } else if (settings.globalCounterType === 'unread_messages') {
                    settings.globalCounterType = 'unread_chats';
                } else if (settings.globalCounterType === 'unread_messages_no_muted') {
                    settings.globalCounterType = 'unread_chats_no_muted';
                }

                await settings.flush(ctx);
            });
            return true;
        }),
        debugReindexOrganizationMembers: withPermission('super-admin', async (parent) => {
            debugTaskForAllBatched<OrganizationMemberShape>(Store.OrganizationMember.descriptor.subspace, parent.auth.uid!, 'debugReindexOrganizationMembers', 100, async (items) => {
                await inTx(parent, async ctx => {
                    for (let item of items) {
                        let entity = await Store.OrganizationMember.findById(ctx, item.value.oid, item.value.uid);
                        entity!.invalidate();
                        await entity!.flush(ctx);
                    }
                });
            });
            return true;
        }),
        debugReindexRoomParticipants: withPermission('super-admin', async (parent) => {
            debugTaskForAllBatched<RoomParticipantShape>(Store.RoomParticipant.descriptor.subspace, parent.auth.uid!, 'debugReindexRoomParticipants', 100, async (items) => {
                await inTx(parent, async ctx => {
                    for (let item of items) {
                        let entity = await Store.RoomParticipant.findById(ctx, item.value.cid, item.value.uid);
                        entity!.invalidate();
                        await entity!.flush(ctx);
                    }
                });
            });
            return true;
        }),
        debugDeleteTask: withPermission('super-admin', async (parent, args) => {
            return inTx(parent, async ctx => {
                let task = await Store.Task.findById(ctx, args.taskType, args.id);
                if (!task) {
                    throw new UserError('Task not found');
                }
                await task.delete(ctx);
                return true;
            });
        }),
        debugDeliverCallStateEventsForAll: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.ConferenceRoom, parent.auth.uid!, 'debugDeliverCallStateEventsForAll', async (ctx, cid, log) => {
                let conference = (await Store.ConferenceRoom.findById(ctx, cid))!;
                let members = await Modules.Messaging.room.findConversationMembers(ctx, cid);
                for (let m of members) {
                    Store.UserDialogEventStore.post(ctx, m, UserDialogCallStateChangedEvent.create({
                        uid: m,
                        cid,
                        hasActiveCall: conference.active || false
                    }));
                }
            });
            return true;
        }),
        debugMigrateMuteSettings: withPermission('super-admin', async (parent, args) => {
            let muteDirectory = Store.UserDialogMuteSettingDirectory
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.boolean);

            debugTaskForAll(Store.User, parent.auth.uid!, 'debugMigrateMuteSettings', async (ctx, uid, log) => {
                let userDialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                await Promise.all(userDialogs.map(async d => {
                    let settings = await Store.UserDialogSettings.findById(ctx, uid, d.cid);
                    if (settings?.mute) {
                        muteDirectory.set(ctx, [uid, d.cid], true);
                    }
                }));
            });
            return true;
        }),
        debugMigrateUserChatsList: withPermission('super-admin', async (parent, args) => {
            let repo = new UserGroupsRepository();

            debugTaskForAll(Store.User, parent.auth.uid!, 'debugMigrateUserChatsList', async (ctx, uid, log) => {
                let userDialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                await Promise.all(userDialogs.map(async d => {
                    let room = await Store.ConversationRoom.findById(ctx, d.cid);
                    if (room) {
                        repo.addGroup(ctx, uid, d.cid);
                    }
                }));
            });
            return true;
        }),
        debugFreeUnusedShortnames: withPermission('super-admin', async (parent, args) => {
            debugTaskForAllBatched<ShortnameReservationShape>(Store.ShortnameReservation.descriptor.subspace, parent.auth.uid!, 'debugFreeUnusedShortnames', 10, async (items) => {
                await inTx(parent, async ctx => {
                    for (let item of items) {
                        let reservation = await Store.ShortnameReservation.findById(ctx, item.value.shortname);
                        if (!reservation) {
                            continue;
                        }
                        if (!reservation.enabled) {
                            await reservation.flush(ctx);
                            continue;
                        }

                        if (reservation.ownerType === 'user') {
                            let user = await Store.User.findById(ctx, reservation.ownerId);
                            if (!user || user.status === 'deleted') {
                                reservation.enabled = false;
                            }
                        } else if (reservation.ownerType === 'org') {
                            let org = await Store.Organization.findById(ctx, reservation.ownerId);
                            if (!org || org.status === 'deleted') {
                                reservation.enabled = false;
                            }
                        } else if (reservation.ownerType === 'room') {
                            let room = await Store.ConversationRoom.findById(ctx, reservation.ownerId);
                            if (!room || room.isDeleted) {
                                reservation.enabled = false;
                            }
                        }

                        await reservation.flush(ctx);
                    }
                });
            });
            return true;
        }),
        debugFreeShortname: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                let reservation = await Store.ShortnameReservation.findById(ctx, args.shortname);
                if (!reservation) {
                    return false;
                }
                if (!reservation.enabled) {
                    return false;
                }
                reservation.enabled = false;
                await reservation.flush(ctx);
                return true;
            });
        }),
        debugRemoveKickedUsersFromOrgChats: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.Organization, parent.auth.uid!, 'debugRemoveKickedUsersFromOrgChats', async (ctx, oid, log) => {
                try {
                    let members = await Store.OrganizationMember.organization.findAll(ctx, 'left', oid);
                    let orgRooms = await Store.ConversationRoom.organizationPublicRooms.findAll(ctx, oid);

                    await Promise.all(orgRooms.map(async room => {
                        await Promise.all(members.map(member => Modules.Messaging.room.leaveRoom(ctx, room.id, member.uid, false)));
                    }));
                } catch (e) {
                    await log(e);
                }
            });
            return true;
        }),
        // debugMigrateToNewCounters: withPermission('super-admin', async (parent, args) => {
        //     debugSubspaceIterator<MessageShape>(Store.Message.descriptor.subspace, parent.auth.uid!, 'debugMigrateToNewCounters', async (next, log) => {
        //         let fastCounters = new FastCountersRepository();
        //         let res: { key: TupleItem[], value: MessageShape }[] = [];
        //         let total = 0;
        //
        //         const handleMessage = async (ctx: Context, id: number) => {
        //             let message = await Store.Message.findById(ctx, id);
        //             if (!message) {
        //                 return;
        //             }
        //             let cid = message.cid;
        //             let seq = message.seq!;
        //
        //             if (message.deleted) {
        //                 await fastCounters.deletedSeqs.add(ctx, [cid], seq);
        //             }
        //             if (message.spans?.find(s => s.type === 'all_mention')) {
        //                 await fastCounters.allMentions.add(ctx, [cid], seq);
        //             }
        //
        //             let userMentions = message.spans?.filter(s => s.type === 'user_mention');
        //             if (userMentions && userMentions.length > 0) {
        //                 await Promise.all(userMentions.map(async m => {
        //                     if (m.type === 'user_mention') {
        //                         await fastCounters.userMentions.add(ctx, [m.user, cid], seq);
        //                     }
        //                 }));
        //             }
        //
        //             if (message.hiddenForUids) {
        //                 await Promise.all(message.hiddenForUids.map(u => fastCounters.hiddenMessages.add(ctx, [u, cid], seq)));
        //             }
        //         };
        //
        //         do {
        //             res = await next(parent, 99);
        //             total += res.length;
        //
        //             try {
        //                 await inTx(parent, async ctx => {
        //                     await Promise.all(res.map(msg => handleMessage(ctx, msg.value.id)));
        //                 });
        //                 if (total % 9900 === 0) {
        //                     await log('done: ' + total);
        //                 }
        //             } catch (e) {
        //                 await log('error: ' + e);
        //             }
        //         } while (res.length > 0);
        //
        //         return 'done, total: ' + total;
        //     });
        //     return true;
        // }),
        // debugMigrateToExperimentalCounters: withPermission('super-admin', async (parent, args) => {
        //     debugSubspaceIterator<MessageShape>(Store.Message.descriptor.subspace, parent.auth.uid!, 'debugMigrateToNewCounters', async (next, log) => {
        //         let experimentalCounters = new ExperimentalCountersRepository();
        //         let res: { key: TupleItem[], value: MessageShape }[] = [];
        //         let total = 0;
        //
        //         function fetchMessageMentions(message: Message) {
        //             let mentions: number[] = [];
        //             for (let span of message.spans || []) {
        //                 if (span.type === 'user_mention') {
        //                     mentions.push(span.user);
        //                 } else if (span.type === 'all_mention') {
        //                     mentions.push(0);
        //                 }
        //             }
        //             return mentions;
        //         }
        //
        //         const handleMessage = async (ctx: Context, id: number) => {
        //             let message = await Store.Message.findById(ctx, id);
        //             if (!message) {
        //                 return;
        //             }
        //             let cid = message.cid;
        //             let seq = message.seq!;
        //
        //             if (message.deleted) {
        //                 return;
        //             }
        //
        //             await experimentalCounters.messages.add(ctx, cid, {
        //                 seq,
        //                 uid: message.uid,
        //                 mentions: fetchMessageMentions(message),
        //                 hiddenFor: message.hiddenForUids || []
        //             });
        //         };
        //
        //         do {
        //             res = await next(parent, 99);
        //             total += res.length;
        //
        //             try {
        //                 await inTx(parent, async ctx => {
        //                     await Promise.all(res.map(msg => handleMessage(ctx, msg.value.id)));
        //                 });
        //                 if (total % 9900 === 0) {
        //                     await log('done: ' + total);
        //                 }
        //             } catch (e) {
        //                 await log('error: ' + e);
        //             }
        //         } while (res.length > 0);
        //
        //         return 'done, total: ' + total;
        //     });
        //     return true;
        // }),
        // debugMigrateToNewerCounters: withPermission('super-admin', async (parent, args) => {
        //     debugSubspaceIterator<MessageShape>(Store.Message.descriptor.subspace, parent.auth.uid!, 'debugMigrateToNewCounters', async (next, log) => {
        //         let newCounters = new AsyncCountersRepository();
        //         let res: { key: TupleItem[], value: MessageShape }[] = [];
        //         let total = 0;
        //
        //         function fetchMessageMentions(message: Message) {
        //             let mentions: number[] = [];
        //             for (let span of message.spans || []) {
        //                 if (span.type === 'user_mention') {
        //                     mentions.push(span.user);
        //                 } else if (span.type === 'all_mention') {
        //                     mentions.push(0);
        //                 }
        //             }
        //             return mentions;
        //         }
        //
        //         const handleMessage = async (ctx: Context, id: number) => {
        //             let message = await Store.Message.findById(ctx, id);
        //             if (!message) {
        //                 return;
        //             }
        //             let cid = message.cid;
        //             let seq = message.seq!;
        //
        //             let chatLastSeq = await Store.ConversationLastSeq.byId(cid).get(ctx);
        //             if (seq > chatLastSeq) {
        //                 return;
        //             }
        //
        //             if (message.deleted) {
        //                 await newCounters.messages.onMessageDelete(ctx, cid, seq);
        //             } else {
        //                 await newCounters.messages.onNewMessage(ctx, cid, {
        //                     seq,
        //                     uid: message.uid,
        //                     mentions: fetchMessageMentions(message),
        //                     hiddenFor: message.hiddenForUids || [],
        //                     deleted: false,
        //                 });
        //             }
        //         };
        //
        //         do {
        //             res = await next(parent, 99);
        //             total += res.length;
        //
        //             try {
        //                 await inTx(parent, async ctx => {
        //                     await Promise.all(res.map(msg => handleMessage(ctx, msg.value.id)));
        //                 });
        //                 if (total % 9900 === 0) {
        //                     await log('done: ' + total);
        //                 }
        //             } catch (e) {
        //                 await log('error: ' + e);
        //             }
        //         } while (res.length > 0);
        //
        //         return 'done, total: ' + total;
        //     });
        //     return true;
        // }),
        debugMigrateToNewLastRead: withPermission('super-admin', async (parent, args) => {
            let userReadSeqsDirectory = new UserReadSeqsDirectory();
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugMigrateToNewLastRead', async (ctx, uid, log) => {
                let userDialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                userReadSeqsDirectory.clearForUser(ctx, uid);

                await Promise.all(userDialogs.map(async d => {
                    let messageId = await Store.UserDialogReadMessageId.get(ctx, uid, d.cid);
                    if (messageId === 0) {
                        await userReadSeqsDirectory.updateReadSeq(ctx, uid, d.cid, 0);
                    } else {
                        let message = await Store.Message.findById(ctx, messageId);
                        if (!message) {
                            await userReadSeqsDirectory.updateReadSeq(ctx, uid, d.cid, 0);
                        } else {
                            await userReadSeqsDirectory.updateReadSeq(ctx, uid, d.cid, message.seq!);
                        }
                    }
                }));
            });
            return true;
        }),
        debugFixReadSeqs: withPermission('super-admin', async (parent, args) => {
            let userReadSeqsDirectory = new UserReadSeqsDirectory();
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugFixReadSeqs', async (ctx, uid, log) => {
                let userDialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
                await Promise.all(userDialogs.map(async d => {
                    let oldUnread = await Store.UserDialogCounter.get(ctx, uid, d.cid);
                    if (oldUnread === 0) {
                        let chatLastSeq = await Store.ConversationLastSeq.get(ctx, d.cid);
                        await userReadSeqsDirectory.updateReadSeq(ctx, uid, d.cid, chatLastSeq);
                    }
                }));
            });
            return true;
        }),
        debugExportUsers: withPermission('super-admin', async (parent, args) => {
            debugSubspaceIterator<UserShape>(Store.User.descriptor.subspace, parent.auth.uid!, 'debugExportUsers', async (next, log) => {
                let res: { key: TupleItem[], value: UserShape }[] = [];
                let total = 0;
                let result: { name: string, id: string, twitter: string, instagram: string }[] = [];

                do {
                    res = await next(parent, 99);
                    total += res.length;

                    try {
                        await inTx(parent, async ctx => {
                            for (let user of res) {
                                let profile = await Store.UserProfile.findById(ctx, user.value.id);
                                if (!profile) {
                                    continue;
                                }
                                result.push({
                                    name: profile.firstName + ' ' + (profile.lastName || ''),
                                    id: IDs.User.serialize(user.value.id),
                                    twitter: profile.twitter || 'none',
                                    instagram: profile.instagram || 'none'
                                });
                            }
                        });
                        if (total % 9900 === 0) {
                            await log('done: ' + total);
                        }
                    } catch (e) {
                        await log('error: ' + e);
                    }
                } while (res.length > 0);
                await inTx(parent, async ctx => {
                    let superNotificationsAppId = await Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
                    let conv = await Modules.Messaging.room.resolvePrivateChat(ctx, ctx.auth.uid!, superNotificationsAppId!);
                    let { file } = await Modules.Media.upload(ctx, Buffer.from(JSON.stringify(result)), '.json');
                    let fileMetadata = await Modules.Media.saveFile(ctx, file);
                    let attachment = {
                        type: 'file_attachment',
                        fileId: file,
                        fileMetadata
                    } as MessageAttachmentFileInput;
                    await Modules.Messaging.sendMessage(ctx, conv.id, superNotificationsAppId!, { attachments: [attachment] }, true);
                });
                return 'done, total: ' + total;
            });
            return true;
        }),
        debugMigrateUserStatus: withPermission('super-admin', async (parent, args) => {
            debugTaskForAll(Store.User, parent.auth.uid!, 'debugMigrateUserStatus', async (ctx, uid, log) => {
                let profile = await Store.UserProfile.findById(ctx, uid);
                if (!profile) {
                    return;
                }
                if (!profile.primaryOrganization) {
                    return;
                }

                let org = await Store.Organization.findById(ctx, profile.primaryOrganization);
                if (!org || org.status === 'deleted') {
                    return;
                }

                let orgProfile = (await Store.OrganizationProfile.findById(ctx, org.id))!;
                profile.status = orgProfile.name.slice(0, 40);
            });
            return true;
        }),
        debugFixMessages: withPermission('super-admin', async (parent, args) => {
            debugSubspaceIterator<MessageShape>(Store.Message.descriptor.subspace, parent.auth.uid!, 'debugFixCompactMessages', async (next, log) => {
                let res: { key: TupleItem[], value: MessageShape }[] = [];
                let total = 0;

                const handleMessage = async (ctx: Context, value: MessageShape) => {
                    if (
                        !value ||
                        !value.isService ||
                        !value.hiddenForUids ||
                        value.hiddenForUids.length === 0
                    ) {
                        return;
                    }

                    let message = await Store.Message.findById(ctx, value.id);
                    if (!message || !message.hiddenForUids) {
                        return;
                    }
                    let hiddenForUid = message.hiddenForUids[0];
                    if (!hiddenForUid) {
                        return;
                    }

                    let privateChat = await Store.ConversationPrivate.findById(ctx, message.cid);
                    if (!privateChat) {
                        return;
                    }

                    let visibleOnlyFor: number;

                    if (hiddenForUid === privateChat.uid1) {
                        visibleOnlyFor = privateChat.uid2;
                    } else {
                        visibleOnlyFor = privateChat.uid1;
                    }
                    message.visibleOnlyForUids = [visibleOnlyFor];
                };

                do {
                    res = await next(parent, 99);
                    total += res.length;

                    try {
                        await inTx(parent, async ctx => {
                            await Promise.all(res.map(msg => handleMessage(ctx, msg.value)));
                        });
                        if (total % 9900 === 0) {
                            await log('done: ' + total);
                        }
                    } catch (e) {
                        await log('error: ' + e);
                    }
                } while (res.length > 0);

                return 'done, total: ' + total;
            });
            return true;
        }),
        debugUserAuth: withPermission('super-admin', async (parent, args) => {
            await inTx(parent, async (ctx) => {
                let token = await Store.AuthToken.findById(ctx, parent.auth.tid!);
                token!.uid = IDs.User.parse(args.id);
                await token!.flush(ctx);
            });
            return true;
        }),
        debugCreateOrganizationMailing: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'debugCreateOrgMailing', async (log) => {
                let spans: MessageSpan[] = [];

                //
                //  Spans
                //
                if (args.spans) {
                    for (let span of args.spans) {
                        if (span.type === 'Bold') {
                            spans.push({ offset: span.offset, length: span.length, type: 'bold_text' });
                        } else if (span.type === 'Italic') {
                            spans.push({ offset: span.offset, length: span.length, type: 'italic_text' });
                        } else if (span.type === 'InlineCode') {
                            spans.push({ offset: span.offset, length: span.length, type: 'inline_code_text' });
                        } else if (span.type === 'CodeBlock') {
                            spans.push({ offset: span.offset, length: span.length, type: 'code_block_text' });
                        } else if (span.type === 'Irony') {
                            spans.push({ offset: span.offset, length: span.length, type: 'irony_text' });
                        } else if (span.type === 'Insane') {
                            spans.push({ offset: span.offset, length: span.length, type: 'insane_text' });
                        } else if (span.type === 'Loud') {
                            spans.push({ offset: span.offset, length: span.length, type: 'loud_text' });
                        } else if (span.type === 'Rotating') {
                            spans.push({ offset: span.offset, length: span.length, type: 'rotating_text' });
                        } else if (span.type === 'Link' && span.url) {
                            spans.push({ offset: span.offset, length: span.length, type: 'link', url: span.url });
                        }
                    }
                }

                let membersStream = Store.OrganizationMember.organization.stream('joined', IDs.Organization.parse(args.oid), { batchSize: 100 });
                let membersCount = -1;
                let total = 0;
                while (membersCount !== 0) {
                    await inTx(parent, async (ctx) => {
                        let members = await membersStream.next(ctx);
                        membersCount = members.length;
                        for (let member of members) {
                            let conv = await Modules.Messaging.room.resolvePrivateChat(ctx, member.uid, IDs.User.parse(args.uid));
                            await Modules.Messaging.sendMessage(ctx, conv.id, IDs.User.parse(args.uid), {
                                message: args.message,
                                spans: spans
                            });
                        }
                        total += membersCount;
                    });
                    await log('Sent ' + total + ' members');
                }

                return 'ok, total: ' + total;
            });
            return true;
        }),
        debugPaymentCancel: withPermission('super-admin', async (parent, args) => {
            await Modules.Wallet.paymentsMediator.tryCancelPayment(parent, IDs.Payment.parse(args.id));
            return true;
        }),
        debugInvalidateAllSocialImages: withPermission('super-admin', async (parent, args) => {
            const cache = new CacheRepository('social-image');
            return await inTx(parent, async ctx => {
                await cache.deleteAll(ctx);
                return true;
            });
        }),
        debugChangeChatPrice: withPermission('super-admin', async (parent, args) => {
            return await inTx(parent, async ctx => {
                let settings = await Store.PremiumChatSettings.findById(ctx, IDs.Conversation.parse(args.cid));
                if (!settings) {
                    return false;
                }
                settings.price = args.price;
                return true;
            });
        }),
        debugCopyChatMembers: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'debugCopyChatMembers', async log => {
                let fromCid = IDs.Conversation.parse(args.fromCid);
                let toCid = IDs.Conversation.parse(args.toCid);

                let sourceMembers = await inTx(parent, async ctx => await Store.RoomParticipant.active.findAll(ctx, fromCid));
                let uids = sourceMembers.map(member => member.uid);

                let destChat = await inTx(parent, async ctx => await Store.ConversationRoom.findById(ctx, toCid));
                if (!destChat || !destChat.ownerId) {
                    return 'dest chat not found';
                }

                let i = 0;
                for (let uid of uids) {
                    try {
                        await inTx(parent, async ctx => {
                            await Modules.Messaging.room.inviteToRoom(ctx, toCid, destChat!.ownerId!, [uid]);
                        });
                    } catch (e) {
                        // noop
                    }
                    i++;
                    if (i % 100 === 0) {
                        await log(`processed ${i} of ${uids.length} users`);
                    }
                }
                return 'ok';
            });
            return true;
        }),
        debugCopyOrgMembers: withPermission('super-admin', async (parent, args) => {
            debugTask(parent.auth.uid!, 'debugCopyChatMembers', async log => {
                let fromOrg = IDs.Organization.parse(args.fromOrg);
                let toOrg = IDs.Organization.parse(args.toOrg);

                let sourceMembers = await inTx(parent, async ctx => await Store.OrganizationMember.organization.findAll(ctx, 'joined', fromOrg));
                let uids = sourceMembers.map(member => member.uid);

                let destOrg = await inTx(parent, async ctx => await Store.Organization.findById(ctx, toOrg));
                if (!destOrg || !destOrg.ownerId) {
                    return 'dest org not found';
                }

                let i = 0;
                for (let uid of uids) {
                    try {
                        await inTx(parent, async ctx => {
                            await Modules.Orgs.addUserToOrganization(ctx, uid, toOrg, destOrg!.ownerId!);
                        });
                    } catch (e) {
                        // noop
                    }
                    i++;
                    if (i % 100 === 0) {
                        await log(`processed ${i} of ${uids.length} users`);
                    }
                }
                return 'ok';
            });
            return true;
        }),
    },
    Subscription: {
        debugEvents: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionDebugEventsArgs, ctx: Context) {
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
            subscribe: async function* (r: any, args: GQL.SubscriptionLifecheckArgs, ctx: Context) {
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
            subscribe: async function* (r: any, args: GQL.SubscriptionDebugReaderStateArgs, ctx: Context) {
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
            subscribe: async function* (r: any, args: GQL.SubscriptionDebugServerIdArgs, ctx: Context) {
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
};
