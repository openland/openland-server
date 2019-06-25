import { injectable } from 'inversify';
import { FDB, Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { ModernScheduller } from 'openland-module-workers/src/TaskScheduler';
import { Modules } from 'openland-modules/Modules';
import { MessageKeyboard } from 'openland-module-messaging/MessageInput';
import { IDs } from 'openland-module-api/IDs';
import { UserProfile } from 'openland-module-db/schema';

type DelayedEvents = 'firstDialogsLoadShort' | 'firstDialogsLoadLong';
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

    readonly RearWorker = new WorkQueue<{ type: DelayedEvents, uid: number }, { type: DelayedEvents, uid: number }>('UserOnboardingRear');
    private readonly scheduler = new ModernScheduller();

    start = () => {
        this.scheduler.start();
        // todo implement delayed worker
    }

    //
    // Triggers
    //

    onDialogsLoad = async (ctx: Context, uid: number) => {
        // first time load
        let seq = (await Modules.Messaging.getUserMessagingState(ctx, uid)).seq;
        if (seq === 0) {
            await this.sendMessage(ctx, uid, templates.wellcome);
            await this.sendToDiscoverIfNeeded(ctx, uid);
            await this.askSendFirstMessageOnFirstLoad(ctx, uid);
        }
    }

    onDiscoverCompleted = async (ctx: Context, uid: number) => {
        await this.askSendFirstMessageAfterDiscover(ctx, uid);
    }

    onTimeoutFired = async (ctx: Context, type: DelayedEvents, uid: number) => {
        if (type === 'firstDialogsLoadShort') {
            await this.askSendFirstMessageAfterShortDelay(ctx, uid);
        } else if (type === 'firstDialogsLoadLong') {
            await this.askInstallApps(ctx, uid);
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

    // Discover
    private sendToDiscoverIfNeeded = async (ctx: Context, uid: number) => {
        let completedDiscoverWithJoin = this.isDiscoverCompletedWithJoin(ctx, uid);
        if (!completedDiscoverWithJoin) {
            await this.sendMessage(ctx, uid, templates.gotoDiscover);
        }
    }

    // First message
    private askSendFirstMessageOnFirstLoad = async (ctx: Context, uid: number) => {
        let completedDiscoverWithJoin = this.isDiscoverCompletedWithJoin(ctx, uid);
        if (completedDiscoverWithJoin) {
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
        // TODO check once
        await this.sendMessage(ctx, uid, templates.invite);
    }

    // get apps
    private askInstallApps = async (ctx: Context, uid: number) => {
        // TODO check once
        await this.sendMessage(ctx, uid, templates.installApps);
    }

    //
    // Utils
    //
    private askSendFirstMessage = async (ctx: Context, uid: number) => {
        // TODO: check once
        await this.sendMessage(ctx, uid, templates.discover);
    }

    sendMessage = async (ctx: Context, uid: number, template: Template) => {
        let billyId = IDs.User.parse('D4xmkrmL51sdX6gwPo9Xc3X5Wy');
        let user = await FDB.UserProfile.findById(ctx, uid);
        if (!user) {
            return;
        }
        let t = template(user);

        // report to super admin chat
        let reportChatId = IDs.Conversation.parse('4dmAE76O54FqenqDMb55ubYlvZ');
        await Modules.Messaging.sendMessage(ctx, reportChatId, billyId, { message: `${user.email} [${t.type}]` });

        // let privateChat = await Modules.Messaging.room.resolvePrivateChat(ctx, billyId, uid);
        // await Modules.Messaging.sendMessage(ctx, privateChat.id, billyId, buildMessage({ type: 'rich_attach', attach: { title: t.message, keyboard: t.keyboard } }));
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

}