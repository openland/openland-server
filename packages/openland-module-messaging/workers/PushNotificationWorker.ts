import { staticWorker } from 'openland-module-workers/staticWorker';
import { DB, DB_SILENT } from 'openland-server/tables';
import { Repos } from 'openland-server/repositories';
import { buildBaseImageUrl } from 'openland-server/repositories/Media';
import { Texts } from 'openland-server/texts';
import { Modules } from 'openland-modules/Modules';
import { withLogContext } from 'openland-log/withLogContext';
import { inTx } from 'foundation-orm/inTx';
import { createLogger } from 'openland-log/createLogger';

const Delays = {
    'none': 10 * 1000,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000
};

const log = createLogger('push');

export function startPushNotificationWorker() {

    staticWorker({ name: 'push_notifications', delay: 3000 }, async () => {

        let unreadUsers = await DB.ConversationsUserGlobal.findAll({
            where: {
                unread: { $gt: 0 },
            },
            logging: DB_SILENT
        });

        log.debug('unread users: ' + unreadUsers.length);
        for (let u of unreadUsers) {
            await inTx(async () => {
                await withLogContext(['user', '' + u.userId], async () => {
                    // Loading user's settings and state
                    let settings = await Modules.Users.getUserSettings(u.userId);
                    let state = await Modules.Messaging.repo.getUserMessagingState(u.userId);

                    let now = Date.now();

                    let lastSeen = await Modules.Presence.getLastSeen(u.userId);

                    // Ignore never-online users
                    if (lastSeen === 'never_online') {
                        return;
                    }

                    // Pause notifications only if delay was set
                    // if (settings.notificationsDelay !== 'none') {
                    // Ignore online
                    if (lastSeen === 'online') {
                        return;
                    }

                    // Pause notifications till 1 minute passes from last active timeout
                    if (lastSeen > (now - Delays[settings.notificationsDelay])) {
                        return;
                    }
                    // }

                    // Ignore read updates
                    if (state.readSeq === u.seq) {
                        return;
                    }

                    // Ignore never opened apps
                    if (state.readSeq === null) {
                        return;
                    }

                    // Ignore user's with disabled notifications
                    if (settings.mobileNotifications === 'none' && settings.desktopNotifications === 'none') {
                        return;
                    }

                    // Ignore already processed updates
                    if (state.lastPushSeq !== null && state.lastPushSeq >= u.seq) {
                        return;
                    }

                    // Scanning updates
                    let remainingUpdates = await DB.ConversationUserEvents.findAll({
                        where: {
                            userId: u.userId,
                            seq: {
                                $gt: Math.max(state.lastPushSeq ? state.lastPushSeq : 0, state.readSeq)
                            }
                        },
                        logging: DB_SILENT
                    });

                    // Handling unread messages
                    let messages = remainingUpdates.filter((v) => v.eventType === 'new_message');
                    let hasMessage = false;
                    for (let m of messages) {
                        let messageId = m.event.messageId as number;
                        let senderId = m.event.senderId as number;
                        let unreadCount = m.event.unreadGlobal as number;
                        // Ignore current user
                        if (senderId === u.userId) {
                            continue;
                        }
                        let message = await DB.ConversationMessage.findById(messageId);
                        if (!message) {
                            continue;
                        }
                        let sender = await Modules.Users.profileById(senderId);
                        if (!sender) {
                            continue;
                        }
                        let receiver = await Modules.Users.profileById(u.userId);
                        if (!receiver) {
                            continue;
                        }
                        let conversation = await DB.Conversation.findById(message.conversationId);
                        if (!conversation) {
                            continue;
                        }

                        let userMentioned = message.extras && message.extras.mentions && (message.extras.mentions as number[]).indexOf(u.userId) > -1;

                        let sendDesktop = settings.desktopNotifications !== 'none';
                        let sendMobile = settings.mobileNotifications !== 'none';

                        // Filter non-private if only direct messages enabled
                        if (settings.desktopNotifications === 'direct') {
                            if (conversation.type !== 'private') {
                                sendDesktop = false;
                            }
                        }
                        if (settings.mobileNotifications === 'direct') {
                            if (conversation.type !== 'private') {
                                sendMobile = false;
                            }
                        }

                        let conversationSettings = await Repos.Chats.getConversationSettings(u.userId, conversation.id);

                        if (conversationSettings.mute && !userMentioned) {
                            continue;
                        }

                        if (conversationSettings.mobileNotifications === 'none') {
                            sendMobile = false;
                        }

                        if (userMentioned) {
                            sendMobile = true;
                            sendDesktop = true;
                        }

                        if (!sendMobile && !sendDesktop) {
                            continue;
                        }

                        let receiverPrimaryOrg = receiver.primaryOrganization;
                        if (!receiverPrimaryOrg) {
                            continue;
                        }
                        let chatTitle = await Repos.Chats.getConversationTitle(conversation.id, receiverPrimaryOrg, u.userId);

                        hasMessage = true;
                        let senderName = [sender.firstName, sender.lastName].filter((v) => !!v).join(' ');

                        let pushTitle = Texts.Notifications.GROUP_PUSH_TITLE({ senderName, chatTitle });

                        if (conversation.type === 'private') {
                            pushTitle = chatTitle;
                        }

                        if (message.isService) {
                            pushTitle = chatTitle;
                        }

                        let pushBody = '';

                        if (message.message) {
                            pushBody += message.message;
                        }
                        if (message.fileMetadata) {
                            pushBody += message.fileMetadata.isImage === true ? Texts.Notifications.IMAGE_ATTACH : Texts.Notifications.FILE_ATTACH;
                        }

                        let push = {
                            uid: u.userId,
                            title: pushTitle,
                            body: pushBody,
                            picture: sender.picture ? buildBaseImageUrl(sender.picture!!) : null,
                            counter: unreadCount,
                            conversationId: conversation.id,
                            mobile: sendMobile,
                            desktop: sendDesktop,
                            mobileAlert: settings.mobileAlert,
                            mobileIncludeText: settings.mobileIncludeText,
                            silent: null
                        };

                        log.debug('new_push', JSON.stringify(push));
                        await Modules.Push.worker.pushWork(push);
                    }

                    // Save state
                    if (hasMessage) {
                        state.lastPushNotification = Date.now();
                    }

                    log.debug('updated ' + state.lastPushSeq + '->' + u.seq);

                    state.lastPushSeq = u.seq;
                });
            });
        }
        return false;
    });
}