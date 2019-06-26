import { injectable } from 'inversify';
import { FDB, Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { Modules } from 'openland-modules/Modules';
import { MessageKeyboard } from 'openland-module-messaging/MessageInput';
import { UserProfile } from 'openland-module-db/schema';
import { DelayedQueue } from 'openland-module-workers/DelayedQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { inTx } from '@openland/foundationdb';
import { buildMessage } from 'openland-utils/MessageBuilder';

type DelayedEvents = 'firstDialogsLoad20h' | 'firstDialogsLoad30m';
type Template = (user: UserProfile) => { type: string, message: string, keyboard?: MessageKeyboard };
const templates: { [templateName: string]: (user: UserProfile) => { message: string, keyboard?: MessageKeyboard, type: string } } = {
    wellcome: (user: UserProfile) => ({ type: 'wellcome', message: `Wellcome ${user.firstName}!` }),
    gotoDiscover: (user: UserProfile) => ({ type: 'gotoDiscover', message: `${user.firstName}, time to complete discover`, keyboard: { buttons: [[{ title: 'Discover', url: '/discover', style: 'DEFAULT' }]] } }),
    sendFirstMessage: (user: UserProfile) => ({ type: 'sendFirstMessage', message: `${user.firstName} what R U waiting for?`, keyboard: { buttons: [[{ title: 'Send Your first message!', url: '/sendFirstMessage', style: 'DEFAULT' }]] } }),
    invite: (user: UserProfile) => ({ type: 'invite', message: `${user.firstName} invite freiends!`, keyboard: { buttons: [[{ title: 'Get invite link', url: '/invite', style: 'DEFAULT' }]] } }),
    installApps: (user: UserProfile) => ({ type: 'installApps', message: `${user.firstName} we have cool apps`, keyboard: { buttons: [[{ title: 'Get apps', url: '/apps', style: 'DEFAULT' }]] } }),
};

@injectable()
export class UserOnboardingModule {
    private delayedWorker = new DelayedQueue<{ uid: number, type: DelayedEvents }, { result: string }>('onboarding-delayed');

    start = () => {
        if (serverRoleEnabled('workers')) {
            this.delayedWorker.start((item, rootCtx) => {
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

    onDialogsLoad = async (ctx: Context, uid: number) => {
        // first time load
        let seq = (await Modules.Messaging.getUserNotificationState(ctx, uid)).readSeq;
        if (seq === 0) {
            await this.sendWellcome(ctx, uid);
            await this.sendToDiscoverIfNeeded(ctx, uid);
            await this.askSendFirstMessageOnFirstLoad(ctx, uid);
            await this.delayedWorker.pushWork(ctx, { uid, type: 'firstDialogsLoad30m' }, Date.now() + 1000 * 60 * 30);
            await this.delayedWorker.pushWork(ctx, { uid, type: 'firstDialogsLoad20h' }, Date.now() + 1000 * 60 * 60 * 20);
        }
    }

    onDiscoverCompleted = async (ctx: Context, uid: number) => {
        await this.askSendFirstMessageAfterDiscover(ctx, uid);
    }

    onTimeoutFired = async (ctx: Context, type: DelayedEvents, uid: number) => {
        if (type === 'firstDialogsLoad20h') {
            await this.askInstallApps(ctx, uid);
        } else if (type === 'firstDialogsLoad30m') {
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
        if (!this.isDiscoverCompletedWithJoin(ctx, uid)) {
            let state = await this.getOnboardingState(ctx, uid);
            if (!state.askCompleteDeiscoverSent) {
                await this.sendMessage(ctx, uid, templates.gotoDiscover);
                state.askCompleteDeiscoverSent = true;
            }
        }
    }

    // First message
    private askSendFirstMessageOnFirstLoad = async (ctx: Context, uid: number) => {
        if (this.isDiscoverCompletedWithJoin(ctx, uid)) {
            await this.askSendFirstMessage(ctx, uid);
        }
    }
    private askSendFirstMessageAfterDiscover = async (ctx: Context, uid: number) => {
        if (!await this.userDidSendMessageToGroups(ctx, uid)) {
            await this.askSendFirstMessage(ctx, uid);
        }
    }

    private askSendFirstMessageAfterShortDelay = async (ctx: Context, uid: number) => {
        if (!this.isDiscoverCompletedWithJoin(ctx, uid) && !this.userDidSendMessageToGroups(ctx, uid) && this.userIsMemberOfAtLesatOneGroup(ctx, uid)) {
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
            state.askInstallAppsSent = true;
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

        // report to super admin chat
        await Modules.Messaging.sendMessage(ctx, reportChatId, billyId, buildMessage(`${user.email} [${t.type}]\n`, t.message, { type: 'rich_attach', attach: { keyboard: t.keyboard } }));

        // let privateChat = await Modules.Messaging.room.resolvePrivateChat(ctx, billyId, uid);
        // await Modules.Messaging.sendMessage(ctx, privateChat.id, billyId, buildMessage(t.message, { type: 'rich_attach', attach: { keyboard: t.keyboard } }));
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
        return !!(await Store.UserMessagesSentCounter.byId(uid).get(ctx) - await Store.UserMessagesSentInDirectChatCounter.byId(uid).get(ctx));
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