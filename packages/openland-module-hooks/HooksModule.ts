import { Events } from 'openland-module-hyperlog/Events';
import { Modules } from 'openland-modules/Modules';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { IDs } from '../openland-module-api/IDs';
import { Store } from '../openland-module-db/FDB';
import {
    AppHook,
    WalletPurchaseCreateShape, WalletSubscriptionCreateShape,
} from 'openland-module-db/store';
import {
    boldString,
    buildMessage, MessagePart,
    orgMention,
    roomMention,
    userMention,
} from '../openland-utils/MessageBuilder';
import { formatMoney, formatMoneyWithInterval } from '../openland-module-wallet/repo/utils/formatMoney';

const getSuperNotificationsBotId = async (ctx: Context) => await Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
const getSuperNotificationsChatId = async (ctx: Context) => await Modules.Super.getEnvVar<number>(ctx, 'super-notifications-chat-id');
const getPaymentsNotificationsChatId = async (ctx: Context) => await Modules.Super.getEnvVar<number>(ctx, 'payments-notifications-chat-id');

@injectable()
export class HooksModule {
    start = async () => {
        // no op
    }

    /*
     * Profiles
     */

    onUserProfileUpdated = async (ctx: Context, uid: number) => {
        Events.ProfileUpdated.event(ctx, { uid });
        await Modules.Messaging.onUserProfileUpdated(ctx, uid);
    }

    onOrganizationProfileUpdated = async (ctx: Context, oid: number) => {
        Events.OrganizationProfileUpdated.event(ctx, { oid });
        await Modules.Messaging.onOrganizationProfileUpdated(ctx, oid);
    }

    onOrganizationCreated = async (ctx: Context, uid: number, oid: number) => {
        Events.OrganizationCreated.event(ctx, { uid, oid });
        // let chat = await Repos.Chats.loadOrganizationalChat(oid, oid, tx);
        // let profile = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx });
        // await Repos.Chats.sendMessage(tx, chat.id, uid, { message: `${profile!.firstName} has joined organization`, isService: true, isMuted: true });
    }

    /*
     * Membership
     */

    onUserJoined = async (ctx: Context, uid: number, oid: number) => {
        // await Emails.sendMemberJoinedEmails(ctx, oid, uid);
        let chat = await Modules.Messaging.room.resolveOrganizationChat(ctx, oid);
        let profile = await Modules.Users.profileById(ctx, uid);
        await Modules.Messaging.sendMessage(ctx, chat.id, uid, { message: `${profile!.firstName} has joined organization`, isService: true, isMuted: true });
    }

    onUserRemoved = async (ctx: Context, uid: number, oid: number) => {
        //
    }

    /*
     * Orgs
     */
    onFirstOrganizationActivated = async (ctx: Context, oid: number, conditions: { type: 'BY_SUPER_ADMIN', uid: number } | { type: 'BY_INVITE', uid: number, inviteType: 'APP' | 'ROOM', inviteOwner: number } | { type: 'OWNER_ADDED_TO_ORG', uid: number, owner: number, otherOid: number } | { type: 'ACTIVATED_AUTOMATICALLY', uid: number }) => {
        let botId = await getSuperNotificationsBotId(ctx);
        let chatId = await getSuperNotificationsChatId(ctx);

        if (!botId || !chatId) {
            return;
        }

        let orgProfile = await Store.OrganizationProfile.findById(ctx, oid);
        // let orgSuperUrl = 'openland.com/super/orgs/' + IDs.SuperAccount.serialize(oid);
        if (conditions.type === 'BY_SUPER_ADMIN') {
            let adminName = await Modules.Users.getUserFullName(ctx, conditions.uid);
            await Modules.Messaging.sendMessage(ctx, chatId, botId, {
                ...buildMessage(boldString(`Organization ${orgProfile!.name} was activated by `), userMention(adminName, conditions.uid)),
                ignoreAugmentation: true,
            });
        } else if (conditions.type === 'BY_INVITE' || conditions.type === 'OWNER_ADDED_TO_ORG') {
            let invitorId = conditions.type === 'BY_INVITE' ? conditions.inviteOwner : conditions.owner;
            let name = await Modules.Users.getUserFullName(ctx, conditions.uid);
            let invitorName = await Modules.Users.getUserFullName(ctx, invitorId);

            await Modules.Messaging.sendMessage(ctx, chatId, botId, {
                ...buildMessage(userMention(name, conditions.uid), ` from `, orgMention(orgProfile?.name!, oid), ' joined, invited by ', userMention(invitorName, invitorId)),
                ignoreAugmentation: true,
            });
        } else if (conditions.type === 'ACTIVATED_AUTOMATICALLY') {
            let name = await Modules.Users.getUserFullName(ctx, conditions.uid);

            await Modules.Messaging.sendMessage(ctx, chatId, botId, {
                ...buildMessage(userMention(name, conditions.uid), ` from `, orgMention(orgProfile?.name!, oid), ' joined'),
                ignoreAugmentation: true,
            });
        }
    }

    onOrganizationSuspended = async (ctx: Context, oid: number, conditions: { type: 'BY_SUPER_ADMIN', uid: number }) => {
        let botId = await getSuperNotificationsBotId(ctx);
        let chatId = await getSuperNotificationsChatId(ctx);

        if (!botId || !chatId) {
            return;
        }

        let orgProfile = await Store.OrganizationProfile.findById(ctx, oid);
        let orgSuperUrl = 'openland.com/super/orgs/' + IDs.SuperAccount.serialize(oid);
        let adminName = await Modules.Users.getUserFullName(ctx, conditions.uid);
        await Modules.Messaging.sendMessage(ctx, chatId, botId, {
            ...buildMessage(`Organization ${orgProfile!.name} was suspended by `, userMention(adminName, conditions.uid), `\nLink: ${orgSuperUrl}`),
            ignoreAugmentation: true,
        });
    }

    onSignUp = async (ctx: Context, uid: number) => {
        // no op
    }

    /*
    * Deprecated
    * */
    onUserProfileCreated = async (ctx: Context, uid: number) => {
        let botId = await getSuperNotificationsBotId(ctx);
        let chatId = await getSuperNotificationsChatId(ctx);

        if (!botId || !chatId) {
            return;
        }

        let user = await Store.User.findById(ctx, uid);
        let userName = await Modules.Users.getUserFullName(ctx, uid);
        let orgs = await Modules.Orgs.findUserOrganizations(ctx, uid);

        if (orgs.length === 0) {
            await Modules.Messaging.sendMessage(ctx, chatId, botId, {
                ...buildMessage(`New user in waitlist: `, userMention(userName, uid), ` with no organization`),
                ignoreAugmentation: true,
            });
        } else {
            let org = await Store.OrganizationProfile.findById(ctx, orgs[0]);
            await Modules.Messaging.sendMessage(ctx, chatId, botId, {
                ...buildMessage(`New user in waitlist: `, userMention(userName, uid), ` (${user!.email}) at ${org!.name}.\nLink: openland.com/super/orgs/${IDs.SuperAccount.serialize(org!.id)}`),
                ignoreAugmentation: true,
            });
        }
    }

    onAppHookCreated = async (ctx: Context, uid: number, hook: AppHook) => {
        let conv = await Store.RoomProfile.findById(ctx, hook.chatId);
        if (!conv) {
            return;
        }

        let message = `${conv.title}\nopenland.com/mail/${IDs.Conversation.serialize(hook.chatId)}\nHook created 👉 https://api.openland.com/apps/chat-hook/${hook.key}`;
        let privateChat = await Modules.Messaging.room.resolvePrivateChat(ctx, hook.appId, uid);
        await Modules.Messaging.sendMessage(ctx, privateChat.id, hook.appId, { message, ignoreAugmentation: true });
    }

    onUserActivated = async (ctx: Context, uid: number) => {
        await Modules.Metrics.onUserActivated(ctx, uid);
        await Modules.Phonebook.onNewUser(ctx, uid);

        const user = await Store.User.findById(ctx, uid);
        if (user!.invitedBy) {
            Store.UserSuccessfulInvitesCounter.byId(user!.invitedBy).increment(ctx);
            Events.SuccessfulInvite.event(ctx, { uid: uid, invitedBy: user!.invitedBy });
            await Modules.Stats.onSuccessfulInvite(ctx, user!);
        }

        await Modules.UserOnboarding.onUserActivated(ctx, uid);
    }

    onUserActivatedByAdmin = async (ctx: Context, uid: number) => {
        await Modules.UserOnboarding.onUserActivatedByAdmin(ctx, uid);
    }

    onDiscoverCompleted = async (ctx: Context, uid: number) => {
        await Modules.UserOnboarding.onDiscoverCompleted(ctx, uid);
    }

    onDiscoverSkipped = async (ctx: Context, uid: number) => {
        await Modules.UserOnboarding.onDiscoverSkipped(ctx, uid);
    }

    onMessageSent = async (ctx: Context, uid: number) => {
        await Modules.UserOnboarding.onMessageSent(ctx, uid);
    }

    onChatMembersCountChange = async (ctx: Context, cid: number, delta: number) => {
        await Modules.Users.onChatMembersCountChange(ctx, cid, delta);
    }

    onNewMobileUser = async (ctx: Context, uid: number) => {
        await Modules.Stats.onNewMobileUser(ctx, uid);
    }

    onEmailSent = (ctx: Context, uid: number) => {
        Modules.Stats.onEmailSent(ctx, uid);
    }

    onDesktopPushSent = (ctx: Context, uid: number) => {
        Store.UserBrowserPushSentCounter.byId(uid).increment(ctx);
    }

    onMobilePushSent = (ctx: Context, uid: number) => {
        Store.UserMobilePushSentCounter.byId(uid).increment(ctx);
    }

    onDialogMuteChanged = async (ctx: Context, uid: number, cid: number, mute: boolean) => {
        if (mute) {
            await Modules.UserOnboarding.onMuted(ctx, uid, cid);
        }
    }

    onRoomLeave = async (ctx: Context, cid: number, uid: number, wasKicked: boolean) => {
        await Modules.Matchmaking.clearProfile(ctx, cid, 'room', uid);

        Modules.Metrics.onChatLeave(ctx, uid, wasKicked);
    }

    onRoomJoin = async (ctx: Context, cid: number, uid: number, by: number) => {
        let addedByUser = uid !== by;

        Modules.Metrics.onChatJoined(ctx, uid, addedByUser);

        await Modules.Feed.onAutoSubscriptionPeerNewMember(ctx, uid, 'room', cid);

        /*
         * Hack for mesto.community
         */
        if (cid === 88912) {
            let mestoDefaultChatIds = [88914, 88910, 88908, 89740, 91565, 99729, 89805, 111097];
            for (let mestoCid of mestoDefaultChatIds) {
                let conv = await Store.ConversationRoom.findById(ctx, mestoCid);
                if (!conv) {
                    continue;
                }
                await Modules.Messaging.room.joinRoom(ctx, mestoCid, uid);
            }
        }
    }

    onOrgJoin = async (ctx: Context, oid: number, uid: number) => {
        await Modules.Feed.onAutoSubscriptionPeerNewMember(ctx, uid, 'organization', oid);
    }

    onSubscriptionPaymentSuccess = async (ctx: Context, uid: number, amount: number, product: WalletSubscriptionCreateShape['proudct']) => {
        let botId = await getSuperNotificationsBotId(ctx);
        let chatId = await getPaymentsNotificationsChatId(ctx);

        if (!botId || !chatId) {
            return;
        }

        let userName = await Modules.Users.getUserFullName(ctx, uid);
        let mention: MessagePart;
        if (product.type === 'group') {
            let room = await Store.RoomProfile.findById(ctx, product.gid);
            if (!room) {
                return;
            }
            mention = roomMention(room.title, room.id);
        } else {
            let donee = await Modules.Users.getUserFullName(ctx, product.uid);
            mention = userMention(donee, product.uid);
        }

        let parts = [
            boldString(formatMoney(amount)),
            ' paid by ',
            userMention(userName, uid),
            ' for ', mention, ' · subscription'
        ];

        await Modules.Messaging.sendMessage(ctx, chatId, botId, {
            ...buildMessage(...parts),
            ignoreAugmentation: true,
        });
    }

    onPurchaseSuccess = async (ctx: Context, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        let botId = await getSuperNotificationsBotId(ctx);
        let chatId = await getPaymentsNotificationsChatId(ctx);

        if (!botId || !chatId) {
            return;
        }

        let userName = await Modules.Users.getUserFullName(ctx, uid);

        let parts = [
            boldString(formatMoney(amount)),
            ' paid by ',
            userMention(userName, uid),
        ];

        if (product.type === 'group') {
            let room = await Store.RoomProfile.findById(ctx, product.gid);
            parts.push(' for ', roomMention(room!.title, product.gid), ' · one-time');
        } else {
            let donee = await Modules.Users.getUserFullName(ctx, product.uid);
            parts.push(' for ', userMention(donee, product.uid), ' · donation');
        }

        await Modules.Messaging.sendMessage(ctx, chatId, botId, {
            ...buildMessage(...parts),
            ignoreAugmentation: true,
        });
    }

    onRoomCreate = async (ctx: Context, uid: number, cid: number, kind: 'group' | 'public', price?: number, interval?: 'week' | 'month') => {
        if (!price) {
            return;
        }

        let botId = await getSuperNotificationsBotId(ctx);
        let chatId = await getPaymentsNotificationsChatId(ctx);

        if (!botId || !chatId) {
            return;
        }
        let userName = await Modules.Users.getUserFullName(ctx, uid);

        let room = await Store.RoomProfile.findById(ctx, cid);
        if (!room) {
            return;
        }

        await Modules.Messaging.sendMessage(ctx, chatId, botId, {
            ...buildMessage(
                roomMention(room.title, cid), ' created by ', userMention(userName, uid),
                ' · ', boldString(formatMoneyWithInterval(price, interval || null)), interval ? ' subscription' : ' one-time',
                ' · ', kind === 'public' ? 'public' : 'secret'
            ),
            ignoreAugmentation: true,
        });
    }
}
