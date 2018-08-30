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

        // console.log(11111);
        // console.log(unreadUsers);

        for (let u of unreadUsers) {
            let lastSeen = await Repos.Users.getUserLastSeen(u.userId, tx);

            // Ignore online or never-online users
            if (lastSeen === null) {
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

            if (settings.desktopNotifications !== 'none') {

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

                    // Filter non-private if only direct messages enabled
                    if (settings.desktopNotifications === 'direct') {
                        if (conversation.type !== 'private') {
                            continue;
                        }
                    }

                    let conversationSettings = await Repos.Chats.getConversationSettings(u.userId, conversation.id);

                    if (conversationSettings.mute) {
                        continue;
                    }

                    let mobile = conversationSettings.mobileNotifications !== 'none';

                    if (conversationSettings.mobileNotifications === 'direct') {
                        if (conversation.type !== 'private') {
                            mobile = false;
                        }
                    }

                    hasMessage = true;
                    let senderName = [user.firstName, user.lastName].filter((v) => !!v).join(' ');
                    await PushWorker.pushWork({
                        uid: u.userId,
                        title: senderName,
                        body: message.message ? message.message!! : '<file>',
                        picture: user.picture ? buildBaseImageUrl(user.picture!!) : null,
                        counter: unreadCount,
                        conversationId: conversation.id,
                        mobile: mobile,
                    }, tx);
                }

                // Save state
                if (hasMessage) {
                    u.lastPushNotification = new Date();
                }
            }
            u.lastPushSeq = u.seq;
            await u.save({ transaction: tx });
        }

        return false;
    });
}