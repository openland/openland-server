import { Modules } from 'openland-modules/Modules';
import { injectable } from 'inversify';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';
import { Context } from 'openland-utils/Context';
import { IDs } from '../openland-module-api/IDs';
import { FDB } from '../openland-module-db/FDB';
import { AppHook } from 'openland-module-db/schema';

const profileUpdated = createHyperlogger<{ uid: number }>('profile-updated');
const organizationProfileUpdated = createHyperlogger<{ oid: number }>('organization-profile-updated');
const organizationCreated = createHyperlogger<{ oid: number, uid: number }>('organization-created');

@injectable()
export class HooksModule {

    start = () => {
        // Nothing to do
    }

    /*
     * Profiles
     */

    onUserProfileUpdated = async (ctx: Context, uid: number) => {
        await profileUpdated.event(ctx, { uid });
        await Modules.Messaging.onUserProfileUpdated(ctx, uid);
    }

    onOrganizationProfileUpdated = async (ctx: Context, oid: number) => {
        await organizationProfileUpdated.event(ctx, { oid });
        await Modules.Messaging.onOrganizationProfileUpdated(ctx, oid);
    }

    onOrganizationCreated = async (ctx: Context, uid: number, oid: number) => {
        await organizationCreated.event(ctx, { uid, oid });
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
    onOrganizationActivated = async (ctx: Context, oid: number, conditions: { type: 'BY_SUPER_ADMIN', uid: number } | { type: 'BY_INVITE', inviteType: 'APP' | 'ROOM', inviteOwner: number } | { type: 'OWNER_ADDED_TO_ORG', owner: number, otherOid: number }) => {
        let botId = await this.getSuperNotificationsBotId(ctx);
        let chatId = await this.getSuperNotificationsChatId(ctx);

        if (!botId || !chatId) {
            return;
        }

        let message = '';
        let orgProfile = await FDB.OrganizationProfile.findById(ctx, oid);
        let orgSuperUrl = 'openland.com/super/orgs/' + IDs.SuperAccount.serialize(oid);

        if (conditions.type === 'BY_SUPER_ADMIN') {
            let adminName = await Modules.Users.getUserFullName(ctx, conditions.uid);
            message = `Organization ${orgProfile!.name} was activated by @${adminName}.\nLink: ${orgSuperUrl}`;
            await Modules.Messaging.sendMessage(ctx, chatId, botId, { message, ignoreAugmentation: true, complexMentions: [{ type: 'User', id: conditions.uid }] });
        } else if (conditions.type === 'BY_INVITE' || conditions.type === 'OWNER_ADDED_TO_ORG') {
            let invitorId = conditions.type === 'BY_INVITE' ? conditions.inviteOwner : conditions.owner;
            let invitorName = await Modules.Users.getUserFullName(ctx, invitorId);

            message = `Organization ${orgProfile!.name} was activated by @${invitorName} via invite.\nLink: ${orgSuperUrl}`;
            await Modules.Messaging.sendMessage(ctx, chatId, botId, { message, ignoreAugmentation: true, complexMentions: [{ type: 'User', id: invitorId }] });
        }
    }

    onOrganizationSuspended = async (ctx: Context, oid: number, conditions: { type: 'BY_SUPER_ADMIN', uid: number }) => {
        let botId = await this.getSuperNotificationsBotId(ctx);
        let chatId = await this.getSuperNotificationsChatId(ctx);

        if (!botId || !chatId) {
            return;
        }

        let orgProfile = await FDB.OrganizationProfile.findById(ctx, oid);
        let orgSuperUrl = 'openland.com/super/orgs/' + IDs.SuperAccount.serialize(oid);
        let adminName = await Modules.Users.getUserFullName(ctx, conditions.uid);
        let message = `Organization ${orgProfile!.name} was suspended by @${adminName}.\nLink: ${orgSuperUrl}`;

        await Modules.Messaging.sendMessage(ctx, chatId, botId, { message, ignoreAugmentation: true, complexMentions: [{ type: 'User', id: conditions.uid }] });
    }

    onSignUp = async (ctx: Context, uid: number) => {
        let botId = await this.getSuperNotificationsBotId(ctx);
        let chatId = await this.getSuperNotificationsChatId(ctx);

        if (!botId || !chatId) {
            return;
        }

        let user = await FDB.User.findById(ctx, uid);
        if (!user) {
            return;
        }
        let message = `New user signing up: ${user.email}`;

        await Modules.Messaging.sendMessage(ctx, chatId, botId, { message, ignoreAugmentation: true });
    }

    onUserProfileCreated = async (ctx: Context, uid: number) => {
        let botId = await this.getSuperNotificationsBotId(ctx);
        let chatId = await this.getSuperNotificationsChatId(ctx);

        if (!botId || !chatId) {
            return;
        }

        let userName = await Modules.Users.getUserFullName(ctx, uid);
        let orgs = await Modules.Orgs.findUserOrganizations(ctx, uid);
        let message = '';

        if (orgs.length === 0) {
            message = `New user in waitlist: @${userName} with no organization`;
        } else {
            let org = await FDB.OrganizationProfile.findById(ctx, orgs[0]);
            message = `New user in waitlist: @${userName} at ${org!.name}.\nLink: openland.com/super/orgs/${IDs.SuperAccount.serialize(org!.id)}`;
        }

        await Modules.Messaging.sendMessage(ctx, chatId, botId, { message, ignoreAugmentation: true, complexMentions: [{ type: 'User', id: uid }] });
    }

    onAppHookCreated = async (ctx: Context, uid: number, hook: AppHook) => {
        let message = `created hook ${hook.key} \n for chat: openland.com/mail/${IDs.Conversation.serialize(hook.chatId)}`;
        let privateChat = await Modules.Messaging.room.resolvePrivateChat(ctx, hook.appId, uid);
        await Modules.Messaging.sendMessage(ctx, privateChat.id, hook.appId, { message, ignoreAugmentation: true });
    }

    private async getSuperNotificationsBotId(ctx: Context) {
        return Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
    }

    private async getSuperNotificationsChatId(ctx: Context) {
        return Modules.Super.getEnvVar<number>(ctx, 'super-notifications-chat-id');
    }
}