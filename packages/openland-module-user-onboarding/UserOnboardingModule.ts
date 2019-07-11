import { injectable } from 'inversify';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { Modules } from 'openland-modules/Modules';
import { MessageKeyboard } from 'openland-module-messaging/MessageInput';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { inTx } from '@openland/foundationdb';
import { buildMessage, MessagePart } from 'openland-utils/MessageBuilder';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { UserProfile } from 'openland-module-db/store';

type DelayedEvents = 'activated20h' | 'activated30m';
type Template = (user: UserProfile) => { type: string, message: MessagePart[], keyboard?: MessageKeyboard, isSevice?: boolean };
const templates: { [templateName: string]: (user: UserProfile) => { type: string, message: MessagePart[], keyboard?: MessageKeyboard, isSevice?: boolean } } = {
    wellcome: (user: UserProfile) => ({
        type: 'wellcome',
        message: ['A chat for Openland tips and announcements'], isSevice: true
    }),
    gotoDiscover: (user: UserProfile) => ({
        type: 'gotoDiscover',
        message: [
            '\nAre you ready to explore Openland?\nLet\'s find the most useful chats based on your interests and needs',
            {
                type: 'file_attach', attach: {
                    type: 'file_attachment',
                    fileId: '7f85f7c4-2eef-4ee2-a627-234675f3c0fd',
                    filePreview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABUOEBIQDRUSERIYFhUZHzQiHx0dH0AuMCY0TENQT0tDSUhUXnlmVFlyWkhJaY9qcnyAh4iHUWWUn5ODnXmEh4L/2wBDARYYGB8cHz4iIj6CVklWgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoL/wAARCAAFABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDqirE5EjD2wKZcKRayguT8tFFD2JlszE2gsSMgE9M0UUVynnXZ/9k=',
                    fileMetadata: {
                        isImage: true,
                        imageWidth: 480,
                        imageHeight: 108,
                        imageFormat: 'PNG',
                        mimeType: 'image/png',
                        name: 'img_bot_discover.png',
                        size: 48905,
                        isStored: true,
                    }
                }
            }
        ],
        keyboard: { buttons: [[{ title: 'Discover chats', url: '/onboarding_discover', style: 'DEFAULT' }]] }
    }),
    sendFirstMessage: (user: UserProfile) => ({
        type: 'sendFirstMessage',
        message: [
            '\nDo you need any expert advice or new connections for your projects? Simply ask for help in one of our chats ',
            {
                type: 'file_attach', attach: {
                    type: 'file_attachment',
                    fileId: '8683ed16-fbad-495c-9995-2160db60d73a',
                    filePreview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABUOEBIQDRUSERIYFhUZHzQiHx0dH0AuMCY0TENQT0tDSUhUXnlmVFlyWkhJaY9qcnyAh4iHUWWUn5ODnXmEh4L/2wBDARYYGB8cHz4iIj6CVklWgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoL/wAARCAAFABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDp2jcsSJCB6c/40sm9YZCWBwhxgY7UUUwRhSXb2xCKCQQG+8R1ooormludCirH/9k=',
                    fileMetadata: {
                        isImage: true,
                        imageWidth: 480,
                        imageHeight: 108,
                        imageFormat: 'PNG',
                        mimeType: 'image/png',
                        name: 'img_bot_message.png',
                        size: 49352,
                        isStored: true,
                    }
                }
            }
        ],
        keyboard: { buttons: [[{ title: 'Share your challenges', url: '/onboarding_send_first_message', style: 'DEFAULT' }]] }
    }),
    invite: (user: UserProfile) => ({
        type: 'invite',
        message: [
            '\nHow do you like Openland community so far?\nIf you love being here, share the invitation with your teammates and friends',
            {
                type: 'file_attach', attach: {
                    type: 'file_attachment',
                    fileId: '40050c00-2ace-4cd0-a1a7-4c3e8cb51bab',
                    filePreview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABUOEBIQDRUSERIYFhUZHzQiHx0dH0AuMCY0TENQT0tDSUhUXnlmVFlyWkhJaY9qcnyAh4iHUWWUn5ODnXmEh4L/2wBDARYYGB8cHz4iIj6CVklWgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoL/wAARCAAFABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDqirEnEjD8BRKSsLHPIFFFTN2iwW5nNJInyhye/NFFFePKtU5nqdSirH//2Q==',
                    fileMetadata: {
                        isImage: true,
                        imageWidth: 480,
                        imageHeight: 108,
                        imageFormat: 'PNG',
                        mimeType: 'image/png',
                        name: 'img_bot_invites.png',
                        size: 41177,
                        isStored: true,
                    }
                }
            }
        ],
        keyboard: { buttons: [[{ title: 'Invite friends', url: '/onboarding_invite', style: 'DEFAULT' }]] }
    }),
    installApps: (user: UserProfile) => ({
        type: 'installApps',
        message: [
            '\nDo you want to get our fastest experience and never miss a message?\nOpenland has desktop and mobile apps for all your devices',
            {
                type: 'file_attach', attach: {
                    type: 'file_attachment',
                    fileId: 'f94a935b-492b-413e-8572-e2d7a8970382',
                    filePreview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABUOEBIQDRUSERIYFhUZHzQiHx0dH0AuMCY0TENQT0tDSUhUXnlmVFlyWkhJaY9qcnyAh4iHUWWUn5ODnXmEh4L/2wBDARYYGB8cHz4iIj6CVklWgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoL/wAARCAAFABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDqirZJ8xh7YFKVJjZN5yQRu7iiimBgS2qxyFEKgD/YBooorqg24ps4pSak0j//2Q==',
                    fileMetadata: {
                        isImage: true,
                        imageWidth: 480,
                        imageHeight: 108,
                        imageFormat: 'PNG',
                        mimeType: 'image/png',
                        name: 'img_bot_apps.png',
                        size: 41982,
                        isStored: true,
                    }
                }
            }
        ],
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

        let user = await Store.UserProfile.findById(ctx, uid);
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
            if (await Store.UserDialog.findById(ctx, uid, cid)) {
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
        let state = await Store.UserOnboardingState.findById(ctx, uid);
        if (!state) {
            state = await Store.UserOnboardingState.create(ctx, uid, {
                wellcomeSent: null,
                askCompleteDeiscoverSent: null,
                askInviteSent: null,
                askInstallAppsSent: null,
                askSendFirstMessageSent: null
            });
        }
        return state;
    }

}