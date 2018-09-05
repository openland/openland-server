import { staticWorker } from '../modules/staticWorker';
import { DB, DB_SILENT } from '../tables';
import { PushWorker } from '.';
import { Repos } from '../repositories';
import { buildBaseImageUrl } from '../repositories/Media';

export function startPushNotificationWorker() {

    staticWorker({ name: 'push_notifications', delay: 1000 }, async (tx) => {

        let unreadUsers = await DB.ConversationsUserGlobal.findAll({
            where: {
                unread: { $gt: 0 },
            },
            transaction: tx,
            lock: tx.LOCK.UPDATE,
            logging: DB_SILENT
        });

        for (let u of unreadUsers) {
            let now = Date.now();

            let lastSeen = await Repos.Users.getUserLastSeen(u.userId, tx);

            let logPrefix = 'push ' + u.userId;

            // Ignore online or never-online users
            if (lastSeen === null) {
                continue;
            }

            // Pause notifications till 1 minute passes from last active timeout
            if (lastSeen > (now - 60 * 1000)) {
                continue;
            }

            // Ignore read updates
            if (u.readSeq === u.seq) {
                continue;
            }

            // Ignore never opened apps
            if (u.readSeq === null) {
                continue;
            }

            // Ignore already processed updates
            if (u.lastPushSeq === u.seq) {
                continue;
            }

            // Loading user's settings
            let settings = await Repos.Users.getUserSettings(u.userId);

            // Ignore user's with disabled notifications
            if (settings.mobileNotifications === 'none' && settings.desktopNotifications === 'none') {
                continue;
            }

            // Scanning updates
            let remainingUpdates = await DB.ConversationUserEvents.findAll({
                where: {
                    userId: u.userId,
                    seq: {
                        $gt: Math.max(u.lastPushSeq, u.readSeq)
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
                let user = await DB.UserProfile.find({ where: { userId: senderId }, transaction: tx });
                if (!user) {
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

                hasMessage = true;
                let senderName = [user.firstName, user.lastName].filter((v) => !!v).join(' ');
                console.log(logPrefix, 'new_push', {
                    uid: u.userId,
                    title: senderName,
                    body: message.message ? message.message!! : '<file>',
                    picture: user.picture ? buildBaseImageUrl(user.picture!!) : null,
                    counter: unreadCount,
                    conversationId: conversation.id,
                    mobile: sendMobile,
                    desktop: sendDesktop
                });
                await PushWorker.pushWork({
                    uid: u.userId,
                    title: senderName,
                    body: message.message ? message.message!! : '<file>',
                    picture: user.picture ? buildBaseImageUrl(user.picture!!) : null,
                    counter: unreadCount,
                    conversationId: conversation.id,
                    mobile: sendMobile,
                    desktop: sendDesktop,
                    mobileAlert: settings.mobileAlert
                }, tx);
            }

            // Save state
            if (hasMessage) {
                u.lastPushNotification = new Date();
            }

            u.lastPushSeq = u.seq;
            await u.save({ transaction: tx });
        }

        return false;
    });
}