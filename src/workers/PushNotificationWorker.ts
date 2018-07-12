import { staticWorker } from '../modules/staticWorker';
import { DB } from '../tables';
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
            logging: false
        });

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

            // Ignore already processed updates
            if (u.lastPushSeq === u.seq) {
                continue;
            }

            // Scanning updates
            let remainingUpdates = await DB.ConversationUserEvents.findAll({
                where: {
                    seq: {
                        $gt: Math.max(u.lastPushSeq, u.readSeq)
                    }
                },
                transaction: tx,
                logging: false
            });

            // Handling unread messages
            let messages = remainingUpdates.filter((v) => v.eventType === 'new_message');
            for (let m of messages) {
                let messageId = m.event.messageId as number;
                let senderId = m.event.senderId as number;
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
                let senderName = [user.firstName, user.lastName].filter((v) => !!v).join(' ');
                await PushWorker.pushWork({
                    uid: u.userId,
                    title: senderName,
                    body: message.message ? message.message!! : '<file>',
                    picture: user.picture ? buildBaseImageUrl(user.picture!!) : null,
                }, tx);
            }

            // Save state
            if (messages.length > 0) {
                u.lastPushNotification = new Date();
            }
            u.lastPushSeq = u.seq;
            await u.save({ transaction: tx });
        }

        return false;
    });
}