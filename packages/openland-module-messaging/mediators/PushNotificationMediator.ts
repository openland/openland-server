import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { AllEntities } from '../../openland-module-db/schema';
import { WorkQueue } from '../../openland-module-workers/WorkQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { createTracer } from '../../openland-log/createTracer';
import { inTx } from '../../foundation-orm/inTx';
import { lazyInject } from '../../openland-modules/Modules.container';
import { RoomMediator } from './RoomMediator';
import { withLogContext } from '../../openland-log/withLogContext';
import { createLogger } from '../../openland-log/createLogger';
import { Modules } from '../../openland-modules/Modules';
import { MessageAttachmentFile } from '../MessageInput';
import { Texts } from '../texts';
import { buildBaseImageUrl } from '../../openland-module-media/ImageRef';
import { hasMention } from 'openland-module-messaging/resolvers/ModernMessage.resolver';

const tracer = createTracer('message-push-delivery');
const log = createLogger('push_delivery');

const Delays = {
    'none': 10 * 1000,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000
};

@injectable()
export class PushNotificationMediator {
    private readonly queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_push_delivery');

    @lazyInject('FDB') private readonly entities!: AllEntities;
    @lazyInject('RoomMediator') private readonly room!: RoomMediator;

    start = () => {
        if (serverRoleEnabled('workers')) {
            this.queue.addWorker(async (item, parent) => {
                await tracer.trace(parent, 'delivery', async (ctx) => {
                    await this.handleNewMessage(ctx, item.messageId);
                });
                return { result: 'ok' };
            });
        }
    }

    onNewMessage = async (ctx: Context, mid: number) => {
        await this.queue.pushWork(ctx, { messageId: mid });
    }

    private async handleNewMessage(parent: Context, mid: number) {
        await inTx(parent, async (ctx) => {
            let message = (await this.entities.Message.findById(ctx, mid))!;
            let members = await this.room.findConversationMembers(ctx, message.cid);

            // Deliver messages
            if (members.length > 0) {
                await Promise.all(members.map((m) => this.handleNewMessageForUser(ctx, m, mid)));
            }
        });
    }

    private async handleNewMessageForUser(parent: Context, uid: number, mid: number) {
        await inTx(parent, async (ctx) => {
            ctx = withLogContext(ctx, ['user', '' + uid]);

            log.log(ctx, 'handleNewMessageForUser', uid);
            let messagingState = await this.entities.UserMessagingState.findById(ctx, uid);
            if (!messagingState) {
                log.log(ctx, 'no messaging state for user');
                return;
            }

            // Loading user's settings and state
            let settings = await Modules.Users.getUserSettings(ctx, messagingState.uid);
            let state = await Modules.Messaging.getUserNotificationState(ctx, messagingState.uid);

            let now = Date.now();

            let lastSeen = await Modules.Presence.getLastSeen(ctx, messagingState.uid);
            let isActive = await Modules.Presence.isActive(ctx, messagingState.uid);

            log.log(ctx, 'seq: ', messagingState.seq, 'lastPushSeq:', state.lastPushSeq, 'readSeq: ', state.readSeq);

            // Ignore never-online users
            if (lastSeen === 'never_online') {
                log.log(ctx, 'skip never-online');
                state.lastPushSeq = messagingState.seq;
                return;
            }

            // Ignore active users
            if (isActive) {
                log.log(ctx, 'skip active');
                return;
            }

            // Pause notifications till 1 minute passes from last active timeout
            if (lastSeen > (now - Delays[settings.notificationsDelay || 'none'])) {
                log.log(ctx, 'skip delay');
                return;
            }

            // Ignore read updates
            if (state.readSeq === messagingState.seq) {
                log.log(ctx, 'ignore read updates');
                return;
            }

            // Ignore never opened apps
            if (state.readSeq === null) {
                log.log(ctx, 'ignore never opened apps');
                return;
            }

            // Ignore user's with disabled notifications
            if (settings.mobileNotifications === 'none' && settings.desktopNotifications === 'none') {
                state.lastPushSeq = messagingState.seq;
                log.log(ctx, 'ignore user\'s with disabled notifications');
                return;
            }

            // Ignore already processed updates
            if (state.lastPushSeq !== null && state.lastPushSeq >= messagingState.seq) {
                log.log(ctx, 'ignore already processed updates');
                return;
            }

            // Scanning updates
            let afterSec = Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq, state.lastPushSeq || 0);

            let remainingUpdates = await this.entities.UserDialogEvent.allFromUserAfter(ctx, messagingState.uid, afterSec);
            let messages = remainingUpdates.filter((v) => v.kind === 'message_received');

            // Handling unread messages
            let hasMessage = false;
            for (let m of messages) {
                if (m.seq <= afterSec) {
                    continue;
                }

                let messageId = m.mid!;
                let message = await this.entities.Message.findById(ctx, messageId);
                if (!message) {
                    continue;
                }
                let senderId = message.uid!;

                let unreadCount = m.allUnread!;
                // Ignore current user
                if (senderId === messagingState.uid) {
                    continue;
                }
                let sender = await Modules.Users.profileById(ctx, senderId);
                if (!sender) {
                    continue;
                }
                let receiver = await Modules.Users.profileById(ctx, messagingState.uid);
                if (!receiver) {
                    continue;
                }
                let conversation = await this.entities.Conversation.findById(ctx, message.cid);
                if (!conversation) {
                    continue;
                }

                // Ignore service messages for big rooms
                if (message.isService) {
                    if (await Modules.Messaging.roomMembersCount(ctx, message.cid) >= 50) {
                        continue;
                    }
                }

                let userMentioned = hasMention(message, messagingState.uid);

                let sendDesktop = settings.desktopNotifications !== 'none';
                let sendMobile = settings.mobileNotifications !== 'none';

                // Filter non-private if only direct messages enabled
                if (settings.desktopNotifications === 'direct') {
                    if (conversation.kind !== 'private') {
                        sendDesktop = false;
                    }
                }
                if (settings.mobileNotifications === 'direct') {
                    if (conversation.kind !== 'private') {
                        sendMobile = false;
                    }
                }

                let conversationSettings = await Modules.Messaging.getRoomSettings(ctx, messagingState.uid, conversation.id);
                if (conversationSettings.mute && !userMentioned) {
                    continue;
                }

                if (userMentioned) {
                    sendMobile = true;
                    sendDesktop = true;
                }

                if (!sendMobile && !sendDesktop) {
                    continue;
                }

                let chatTitle = await Modules.Messaging.room.resolveConversationTitle(ctx, conversation.id, messagingState.uid);

                if (chatTitle.startsWith('@')) {
                    chatTitle = chatTitle.slice(1);
                }

                hasMessage = true;
                let senderName = [sender.firstName, sender.lastName].filter((v) => !!v).join(' ');

                let pushTitle = Texts.Notifications.GROUP_PUSH_TITLE({ senderName, chatTitle });

                if (conversation.kind === 'private') {
                    pushTitle = chatTitle;
                }

                if (message.isService) {
                    pushTitle = chatTitle;
                }

                let pushBody = '';

                if (message.text) {
                    pushBody += message.text;
                }
                if (message.attachmentsModern) {
                    let fileAttachment = message.attachmentsModern.find(a => a.type === 'file_attachment');

                    if (fileAttachment) {
                        let attach = fileAttachment as MessageAttachmentFile;
                        let mime = attach.fileMetadata && attach.fileMetadata.mimeType;

                        if (!mime) {
                            pushBody += Texts.Notifications.DOCUMENT_ATTACH;
                        } else if (mime === 'image/gif') {
                            pushBody += Texts.Notifications.GIF_ATTACH;
                        } else if (attach.fileMetadata && attach.fileMetadata.isImage) {
                            pushBody += Texts.Notifications.IMAGE_ATTACH;
                        } else if (mime.startsWith('video/')) {
                            pushBody += Texts.Notifications.VIDEO_ATTACH;
                        }
                    }
                }

                if (pushBody.length === 0 && message.replyMessages) {
                    pushBody += Texts.Notifications.REPLY_ATTACH;
                }

                let push = {
                    uid: messagingState.uid,
                    title: pushTitle,
                    body: pushBody,
                    picture: sender.picture ? buildBaseImageUrl(sender.picture!!) : null,
                    counter: unreadCount,
                    conversationId: conversation.id,
                    mobile: sendMobile,
                    desktop: sendDesktop,
                    mobileAlert: (settings.mobileAlert !== undefined && settings.mobileAlert !== null) ? settings.mobileAlert : true,
                    mobileIncludeText: (settings.mobileIncludeText !== undefined && settings.mobileIncludeText !== null) ? settings.mobileIncludeText : true,
                    silent: null
                };

                log.log(ctx, 'new_push', JSON.stringify(push));
                await Modules.Push.worker.pushWork(ctx, push);
                // workDone = true;
            }

            // Save state
            if (hasMessage) {
                state.lastPushNotification = Date.now();
            }

            log.log(ctx, 'updated ' + state.lastPushSeq + ' -> ' + messagingState.seq);

            state.lastPushSeq = messagingState.seq;
        });
    }
}