import { staticWorker } from '../modules/staticWorker';
import { DB, DB_SILENT } from '../tables';
import { PushWorker } from '.';
import { Repos } from '../repositories';
import { buildBaseImageUrl } from '../repositories/Media';
import { Texts } from '../texts';

const Delays = {
    'none': 0,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000
};

export function startPushNotificationWorker() {

    staticWorker({ name: 'push_notifications', delay: 3000 }, async (tx) => {
        let unreadUsers = await DB.ConversationsUserGlobal.findAll({
            where: {
                unread: { $gt: 0 },
            },
            transaction: tx,
            logging: DB_SILENT
        });

        for (let u of unreadUsers) {

            // Loading user's settings
            let settings = await Repos.Users.getUserSettings(u.userId);

            let now = Date.now();

            let logPrefix = 'push_worker ' + u.userId;

            let lastSeen = await Repos.Users.getUserLastSeenExtended(u.userId, tx);

            // Ignore never-online users
            if (lastSeen === 'never_online') {
                continue;
            }

            // Pause notifications only if delay was set
            if (settings.notificationsDelay !== 'none') {
                // Ignore online
                if (lastSeen === 'online') {
                    continue;
                }

                // Pause notifications till 1 minute passes from last active timeout
                if (lastSeen > (now - Delays[settings.notificationsDelay])) {
                    continue;
                }
            }

            // Ignore read updates
            if (u.readSeq === u.seq) {
                continue;
            }

            // Ignore never opened apps
            if (u.readSeq === null) {
                continue;
            }

            // Ignore user's with disabled notifications
            if (settings.mobileNotifications === 'none' && settings.desktopNotifications === 'none') {
                continue;
            }

            let notificationsState = await DB.ConversationsUserGlobalNotifications.find({
                where: {
                    userId: u.userId,
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE,
                logging: DB_SILENT,
            });

            if (!notificationsState) {
                notificationsState = await DB.ConversationsUserGlobalNotifications.create({ userId: u.userId }, { transaction: tx });
            }

            // Ignore already processed updates
            if (u.lastPushSeq === u.seq) {
                continue;
            }

            // Scanning updates
            let remainingUpdates = await DB.ConversationUserEvents.findAll({
                where: {
                    userId: u.userId,
                    seq: {
                        $gt: Math.max(Math.max(notificationsState.lastPushSeq, u.lastPushSeq), u.readSeq)
                    }
                },
                transaction: tx,
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
                let message = await DB.ConversationMessage.findById(messageId, { transaction: tx });
                if (!message) {
                    continue;
                }
                let sender = await DB.UserProfile.find({ where: { userId: senderId }, transaction: tx });
                if (!sender) {
                    continue;
                }
                let receiver = await DB.UserProfile.find({ where: { userId: u.userId }, transaction: tx });
                if (!receiver) {
                    continue;
                }
                let conversation = await DB.Conversation.findById(message.conversationId, { transaction: tx });
                if (!conversation) {
                    continue;
                }

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

                if (conversationSettings.mute) {
                    continue;
                }

                if (conversationSettings.mobileNotifications === 'none') {
                    sendMobile = false;
                }

                if (!sendMobile && !sendDesktop) {
                    continue;
                }

                let receiverPrimaryOrg = receiver.primaryOrganization;
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
                    mobileIncludeText: settings.mobileIncludeText
                };

                console.log(logPrefix, 'new_push', JSON.stringify(push));
                await PushWorker.pushWork(push, tx);
            }

            // Save state
            if (hasMessage) {
                notificationsState.lastPushNotification = new Date();
            }

            notificationsState.lastPushSeq = u.seq;
            await notificationsState.save({ transaction: tx });

        }

        return false;
    });
}