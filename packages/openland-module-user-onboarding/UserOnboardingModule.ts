import { injectable } from 'inversify';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { Modules } from 'openland-modules/Modules';
import { MessageInput, MessageKeyboard } from 'openland-module-messaging/MessageInput';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { inTx } from '@openland/foundationdb';
import { buildMessage, MessagePart } from 'openland-utils/MessageBuilder';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { UserProfile } from 'openland-module-db/store';

type DelayedEvents = 'activated20h' | 'activated30m';
type Template = 'welcome' | 'writeFirstMessage' | 'installApps' | 'inviteFriends';
const templates: { [T in Template]: (user: UserProfile) => { type: string, message: MessagePart[], keyboard?: MessageKeyboard, isSevice?: boolean } } = {
    welcome: (user: UserProfile) => ({
        type: 'wellcome',
        message: ['Welcome to Openland! \n' + 'Our bot will share with you some great tips and announcements from Openland team'], isSevice: true
    }),
    writeFirstMessage: (user: UserProfile) => ({
        type: 'sendFirstMessage',
        message: [
            'Need any expert advice or new connections for your projects? Simply ask for help in one of our chats', {
                type: 'file_attach', attach: {
                    type: 'file_attachment',
                    fileId: '93fa4b08-f028-49d3-bf4d-845d777f3892',
                    filePreview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABUOEBIQDRUSERIYFhUZHzQiHx0dH0AuMCY0TENQT0tDSUhUXnlmVFlyWkhJaY9qcnyAh4iHUWWUn5ODnXmEh4L/2wBDARYYGB8cHz4iIj6CVklWgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoL/wAARCAAGABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDqnjmLErLgZ4GKeAyxHLFjjrRRQCK4yeeKKKKZsf/Z',
                    fileMetadata: {
                        isStored: true,
                        isImage: true,
                        imageWidth: 500,
                        imageHeight: 160,
                        imageFormat: 'PNG',
                        mimeType: 'image/png',
                        name: 'usrSUtq.png',
                        size: 16708
                    },
                    previewFileMetadata: null,
                    previewFileId: null,
                    videoMetadata: null
                }
            }
        ],
        keyboard: { buttons: [[{ title: 'Share your challenges', url: '/onboarding_send_first_message', style: 'DEFAULT' }]] }
    }),
    inviteFriends: (user: UserProfile) => ({
        type: 'invite',
        message: [
            'We hope you\'re enjoying the Openland community so far. To share the love, invite your teammates and friends ♥️', {
                type: 'file_attach', attach: {
                    type: 'file_attachment',
                    fileId: 'a4a8a41e-a39f-4c6c-8cd3-644435083f67',
                    filePreview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABUOEBIQDRUSERIYFhUZHzQiHx0dH0AuMCY0TENQT0tDSUhUXnlmVFlyWkhJaY9qcnyAh4iHUWWUn5ODnXmEh4L/2wBDARYYGB8cHz4iIj6CVklWgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoL/wAARCAAGABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDrSshJxIAOw20vzCP5myfXGKKKAIwSvXvzRRRUkn//2Q==',
                    fileMetadata: {
                        isStored: true,
                        isImage: true,
                        imageWidth: 500,
                        imageHeight: 160,
                        imageFormat: 'PNG',
                        mimeType: 'image/png',
                        name: 'vFDKtoV.png',
                        size: 12861
                    },
                    previewFileMetadata: null,
                    previewFileId: null,
                    videoMetadata: null
                }
            }
        ],
        keyboard: { buttons: [[{ title: 'Invite friends', url: '/onboarding_invite', style: 'DEFAULT' }]] }
    }),
    installApps: (user: UserProfile) => ({
        type: 'installApps',
        message: [
            'Want to get our richest experience? Never miss a thing with Openland mobile and desktop apps!', {
                type: 'file_attach', attach: {
                    type: 'file_attachment',
                    fileId: '3ab01bb1-6ee4-47f0-8dd8-69e5cdc38bcb',
                    filePreview: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABUOEBIQDRUSERIYFhUZHzQiHx0dH0AuMCY0TENQT0tDSUhUXnlmVFlyWkhJaY9qcnyAh4iHUWWUn5ODnXmEh4L/2wBDARYYGB8cHz4iIj6CVklWgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoL/wAARCAAGABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDqnjmLErLgdhinKj+UVZ9zHuaKKEBFH865CKOcdTRRRWrKP//Z',
                    fileMetadata: {
                        isStored: true,
                        isImage: true,
                        imageWidth: 500,
                        imageHeight: 160,
                        imageFormat: 'PNG',
                        mimeType: 'image/png',
                        name: 'TaMhKqj.png',
                        size: 10132
                    },
                    previewFileMetadata: null,
                    previewFileId: null,
                    videoMetadata: null
                }
            },
        ],
        keyboard: { buttons: [[{ title: 'Install apps', url: '/onboarding_apps', style: 'DEFAULT' }]] }
    }),
};
@injectable()
export class UserOnboardingModule {
    private readonly q = new WorkQueue<{ uid: number, type: DelayedEvents }>('onboarding-delayed');
    
    start = async () => {
        if (serverRoleEnabled('workers')) {
            this.q.addWorker((item, rootCtx) => {
                return inTx(rootCtx, async (ctx) => {
                    await this.onTimeoutFired(ctx, item.type, item.uid);
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

    onUserActivatedByAdmin = async (ctx: Context, uid: number) => {
        await this.onFirstEntrance(ctx, uid);
        await this.q.pushWork(ctx, { uid, type: 'activated30m' }, Date.now() + 1000 * 60 * 30);
    }

    onDiscoverCompleted = async (ctx: Context, uid: number) => {
        await this.onFirstEntrance(ctx, uid);
        await this.askSendFirstMessageAfterDiscover(ctx, uid);
    }

    onDiscoverSkipped = async (ctx: Context, uid: number) => {
        await this.onFirstEntrance(ctx, uid);
        await this.q.pushWork(ctx, { uid, type: 'activated30m' }, Date.now() + 1000 * 60 * 30);
    }

    onFirstEntrance = async (ctx: Context, uid: number) => {
        await this.sendWelcome(ctx, uid);
        await this.q.pushWork(ctx, { uid, type: 'activated20h' }, Date.now() + 1000 * 60 * 60 * 20);
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

    onMuted = async (ctx: Context, uid: number, cid: number) => {
        // let billyId = await Modules.Super.getEnvVar<number>(ctx, 'onboarding-bot-id');
        // let conv = await Store.ConversationPrivate.findById(ctx, cid);
    }

    //
    // Actions
    //

    // Welcome
    private sendWelcome = async (ctx: Context, uid: number) => {
        let state = await this.getOnboardingState(ctx, uid);
        if (!state.wellcomeSent) {
            await this.sendTemplatedMessage(ctx, uid, 'welcome');
            state.wellcomeSent = true;
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
            await this.sendTemplatedMessage(ctx, uid, 'inviteFriends');
            state.askInviteSent = true;
        }
    }

    // get apps
    private askInstallApps = async (ctx: Context, uid: number) => {
        let state = await this.getOnboardingState(ctx, uid);
        if (!state.askInstallAppsSent) {
            await this.sendTemplatedMessage(ctx, uid, 'installApps');
            state.askInstallAppsSent = true;
        }
    }

    //
    // Utils
    //
    private askSendFirstMessage = async (ctx: Context, uid: number) => {
        let state = await this.getOnboardingState(ctx, uid);
        if (!state.askSendFirstMessageSent) {
            await this.sendTemplatedMessage(ctx, uid, 'writeFirstMessage');
            state.askSendFirstMessageSent = true;
        }
    }

    sendTemplatedMessage = async (ctx: Context, uid: number, template: Template) => {
        let user = await Store.UserProfile.findById(ctx, uid);
        if (!user) {
            return;
        }
        let t = templates[template](user);

        let messageParts: MessagePart[] = [...t.message];
        if (t.keyboard) {
            messageParts.push({ type: 'rich_attach', attach: { keyboard: t.keyboard } });
        }
        // report to super admin chat
        // let reportMessageParts = [`${user.email} [${t.type}]\n`, ...messageParts];
        // await Modules.Messaging.sendMessage(ctx, reportChatId, billyId, buildMessage(...reportMessageParts));

        let message = buildMessage(...messageParts);
        if (t.isSevice) {
            message.isService = true;
        }
        await this.sendMessage(ctx, uid, message);
    }

    sendMessage = async (ctx: Context, uid: number, message: MessageInput) => {
        let billyId = await Modules.Super.getEnvVar<number>(ctx, 'onboarding-bot-id');
        let reportChatId = await Modules.Super.getEnvVar<number>(ctx, 'onboarding-report-cid');
        if (billyId === null || reportChatId === null) {
            return;
        }

        let user = await Store.UserProfile.findById(ctx, uid);
        if (!user) {
            return;
        }

        // report to super admin chat
        // let reportMessageParts = [`${user.email} [${t.type}]\n`, ...messageParts];
        // await Modules.Messaging.sendMessage(ctx, reportChatId, billyId, buildMessage(...reportMessageParts));

        let privateChat = await Modules.Messaging.room.resolvePrivateChat(ctx, billyId, uid);
        await Modules.Messaging.sendMessage(ctx, privateChat.id, billyId, message);
    }

    private userDidSendMessageToGroups = async (ctx: Context, uid: number) => {
        return !!(await Store.UserMessagesSentCounter.byId(uid).get(ctx) - await Store.UserMessagesSentInDirectChatTotalCounter.byId(uid).get(ctx));
    }

    private userIsMemberOfAtLesatOneGroup = async (ctx: Context, uid: number) => {
        return !!(await Store.UserMessagesChatsCounter.byId(uid).get(ctx) - await Store.UserMessagesDirectChatsCounter.byId(uid).get(ctx) - await Store.UserMessagesChannelsCounter.byId(uid).get(ctx));
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