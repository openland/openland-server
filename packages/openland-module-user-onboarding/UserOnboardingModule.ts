import { injectable } from 'inversify';
import { FDB, Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { Modules } from 'openland-modules/Modules';
import { MessageKeyboard } from 'openland-module-messaging/MessageInput';
import { UserProfile } from 'openland-module-db/schema';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { inTx } from '@openland/foundationdb';
import { buildMessage, MessagePart } from 'openland-utils/MessageBuilder';
import { WorkQueue } from 'openland-module-workers/WorkQueue';

type DelayedEvents = 'activated20h' | 'activated30m';
type Template = (user: UserProfile) => { type: string, message: MessagePart[], keyboard?: MessageKeyboard, isSevice?: boolean };
const templates: { [templateName: string]: (user: UserProfile) => { type: string, message: MessagePart[], keyboard?: MessageKeyboard, isSevice?: boolean } } = {
    wellcome: (user: UserProfile) => ({
        type: 'wellcome',
        message: ['A chat for Openland tips and announcements'], isSevice: true
    }),
    gotoDiscover: (user: UserProfile) => ({
        type: 'gotoDiscover',
        message: [{ type: 'loud_text', parts: ['Find chats for you'] }, '\nAre you ready to explore Openland?\nLet\'s find the most useful chats based on your interests and needs'],
        keyboard: { buttons: [[{ title: 'Discover chats', url: '/onboarding_discover', style: 'DEFAULT' }]] }
    }),
    sendFirstMessage: (user: UserProfile) => ({
        type: 'sendFirstMessage',
        message: [{ type: 'loud_text', parts: ['Get help from Openland community'] }, '\nChoose a chat and share your challenges'],
        keyboard: { buttons: [[{ title: 'Share your challenges', url: '/onboarding_send_first_message', style: 'DEFAULT' }]] }
    }),
    invite: (user: UserProfile) => ({
        type: 'invite',
        message: [{ type: 'loud_text', parts: ['Invite friends'] }, '\nHow do you like Openland community so far?\nIf you love being here, share the invitation with your teammates and friends'],
        keyboard: { buttons: [[{ title: 'Get invite link', url: '/onboarding_invite', style: 'DEFAULT' }]] }
    }),
    installApps: (user: UserProfile) => ({
        type: 'installApps',
        message: [{ type: 'loud_text', parts: ['Stay in the loop'] }, '\nDo you want to get our fastest experience and never miss a message?\nOpenland has desktop and mobile apps for all your devices'],
        keyboard: { buttons: [[{ title: 'Install apps', url: '/onboarding_apps', style: 'DEFAULT' }]] }
    }),
};
const q = new WorkQueue<{ uid: number, type: DelayedEvents }, { result: string }>('onboarding-delayed');
@injectable()
export class UserOnboardingModule {

    start = () => {
        if (serverRoleEnabled('workers')) {
            q.addWorker((item, rootCtx) => {
                return inTx(rootCtx, async (ctx) => {
                    await this.onTimeoutFired(ctx, item.type, item.uid);
                    return { result: item.type };
                });
            });
        }
    }

    //
    // Triggers
    //

    onUserActivated = async (ctx: Context, uid: number) => {
        //
    }

    onDiscoverCompleted = async (ctx: Context, uid: number) => {
        await this.onFirstEntrance(ctx, uid);
        await this.askSendFirstMessageAfterDiscover(ctx, uid);
    }

    onDiscoverSkipped = async (ctx: Context, uid: number) => {
        await this.onFirstEntrance(ctx, uid);
        await this.sendToDiscoverIfNeeded(ctx, uid);
        await q.pushWork(ctx, { uid, type: 'activated30m' }, Date.now() + 1000 * 60 * 30);

    }

    onFirstEntrance = async (ctx: Context, uid: number) => {
        await this.sendWellcome(ctx, uid);
        await q.pushWork(ctx, { uid, type: 'activated20h' }, Date.now() + 1000 * 60 * 60 * 20);
    }

    onTimeoutFired = async (ctx: Context, type: DelayedEvents, uid: number) => {
        if (type === 'activated20h') {
            await this.askInstallApps(ctx, uid);
        } else if (type === 'activated30m') {
            await this.askSendFirstMessageAfterShortDelay(ctx, uid);
        }
    }

    onMessageSent = async (ctx: Context, uid: number) => {
        let ms = await Store.UserMessagesSentCounter.byId(uid).get(ctx);
        if (ms === 5) {
            await this.askInviteFriends(ctx, uid);
        }
        if (ms === 1) {
            await this.askInstallApps(ctx, uid);
        }
    }

    //
    // Actions
    //

    // Wellcome
    private sendWellcome = async (ctx: Context, uid: number) => {
        let state = await this.getOnboardingState(ctx, uid);
        if (!state.wellcomeSent) {
            await this.sendMessage(ctx, uid, templates.wellcome);
            state.wellcomeSent = true;
        }
    }

    // Discover
    private sendToDiscoverIfNeeded = async (ctx: Context, uid: number) => {
        if (!await this.isDiscoverCompletedWithJoin(ctx, uid)) {
            let state = await this.getOnboardingState(ctx, uid);
            if (!state.askCompleteDeiscoverSent) {
                await this.sendMessage(ctx, uid, templates.gotoDiscover);
                state.askCompleteDeiscoverSent = true;
            }
        }
    }

    // First message
    private askSendFirstMessageAfterDiscover = async (ctx: Context, uid: number) => {
        if (!await this.userDidSendMessageToGroups(ctx, uid)) {
            await this.askSendFirstMessage(ctx, uid);
        }
    }

    private askSendFirstMessageAfterShortDelay = async (ctx: Context, uid: number) => {
        if (!await this.userDidSendMessageToGroups(ctx, uid) && await this.userIsMemberOfAtLesatOneGroup(ctx, uid)) {
            await this.askSendFirstMessage(ctx, uid);
        }
    }

    // Invite friends 
    private askInviteFriends = async (ctx: Context, uid: number) => {
        let state = await this.getOnboardingState(ctx, uid);
        if (!state.askInviteSent) {
            await this.sendMessage(ctx, uid, templates.invite);
            state.askInviteSent = true;
        }
    }

    // get apps
    private askInstallApps = async (ctx: Context, uid: number) => {
        let state = await this.getOnboardingState(ctx, uid);
        if (!state.askInstallAppsSent) {
            await this.sendMessage(ctx, uid, templates.installApps);
            state.askInstallAppsSent = true;
        }
    }

    //
    // Utils
    //
    private askSendFirstMessage = async (ctx: Context, uid: number) => {
        let state = await this.getOnboardingState(ctx, uid);
        if (!state.askSendFirstMessageSent) {
            await this.sendMessage(ctx, uid, templates.sendFirstMessage);
            state.askSendFirstMessageSent = true;
        }
    }

    sendMessage = async (ctx: Context, uid: number, template: Template) => {
        let billyId = await Modules.Super.getEnvVar<number>(ctx, 'onboarding-bot-id');
        let reportChatId = await Modules.Super.getEnvVar<number>(ctx, 'onboarding-report-cid');
        if (billyId === null || reportChatId === null) {
            return;
        }

        let user = await FDB.UserProfile.findById(ctx, uid);
        if (!user) {
            return;
        }
        let t = template(user);

        let messageParts: MessagePart[] = [...t.message];
        if (t.keyboard) {
            messageParts.push({ type: 'rich_attach', attach: { keyboard: t.keyboard } });
        }
        // report to super admin chat
        let reportMessageParts = [`${user.email} [${t.type}]\n`, ...messageParts];
        await Modules.Messaging.sendMessage(ctx, reportChatId, billyId, buildMessage(...reportMessageParts));

        if (user.email && user.email.includes('+test@maildu.de')) {
            let privateChat = await Modules.Messaging.room.resolvePrivateChat(ctx, billyId, uid);
            let message = buildMessage(...messageParts);
            if (t.isSevice) {
                message.isService = true;
            }
            await Modules.Messaging.sendMessage(ctx, privateChat.id, billyId, message);
        }

    }

    private isDiscoverCompletedWithJoin = async (ctx: Context, uid: number) => {
        let chatIds = await Modules.Discover.suggestedChats(ctx, uid);
        let completedDiscoverWithJoin = false;
        for (let cid of chatIds) {
            if (await FDB.UserDialog.findById(ctx, uid, cid)) {
                completedDiscoverWithJoin = true;
                break;
            }
        }
        return completedDiscoverWithJoin;
    }

    private userDidSendMessageToGroups = async (ctx: Context, uid: number) => {
        return !!(await Store.UserMessagesSentCounter.byId(uid).get(ctx) - await Store.UserMessagesSentInDirectChatTotalCounter.byId(uid).get(ctx));
    }

    private userIsMemberOfAtLesatOneGroup = async (ctx: Context, uid: number) => {
        return !!(await Store.UserMessagesChatsCounter.byId(uid).get(ctx) - await Store.UserMessagesDirectChatsCounter.byId(uid).get(ctx));
    }

    private getOnboardingState = async (ctx: Context, uid: number) => {
        let state = await FDB.UserOnboardingState.findById(ctx, uid);
        if (!state) {
            state = await FDB.UserOnboardingState.create(ctx, uid, {});
        }
        return state;
    }

}