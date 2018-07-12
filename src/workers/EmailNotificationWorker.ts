import { staticWorker } from '../modules/staticWorker';
import { DB } from '../tables';
import { Repos } from '../repositories';
import { Emails } from '../services/Emails';

export function startEmailNotificationWorker() {
    staticWorker({ name: 'email_notifications', delay: 15000 }, async (tx) => {
        let unreadUsers = await DB.ConversationsUserGlobal.findAll({
            where: {
                unread: { $gt: 0 }
            },
            transaction: tx,
            lock: tx.LOCK.UPDATE
        });
        let now = Date.now();
        for (let u of unreadUsers) {
            let lastSeen = await Repos.Users.getUserLastSeen(u.userId, tx);

            // Ignore online or never-online users
            if (lastSeen === null) {
                continue;
            }

            // Ignore recently online users
            if (lastSeen > now - 5 * 60 * 1000) {
                continue;
            }

            // Ignore read updates
            if (u.readSeq === u.seq) {
                continue;
            }

            // Ignore already processed updates
            if (u.lastEmailSeq === u.seq) {
                continue;
            }

            // Do not send emails more than one in an hour
            if (u.lastEmailNotification !== null && u.lastEmailNotification.getTime() > now - 60 * 60 * 1000) {
                continue;
            }

            // Fetch pending updates
            let remainingUpdates = await DB.ConversationUserEvents.findAll({
                where: {
                    userId: u.userId,
                    seq: {
                        $gt: Math.max(u.lastEmailSeq, u.readSeq)
                    }
                },
                transaction: tx,
                logging: false
            });
            let messages = remainingUpdates
                .filter((v) => v.eventType === 'new_message')
                .filter((v) => v.event.senderId !== u.userId);

            let hasNonMuted = false;
            for (let m of messages) {
                if (!(await DB.ConversationMessage.findById(m.event.messageId as number, { transaction: tx }))!!.isMuted) {
                    hasNonMuted = true;
                }
            }

            // Send email notification if there are some
            if (hasNonMuted) {
                u.lastEmailNotification = new Date();
                await Emails.sendUnreadMesages(u.userId, u.unread, tx);
            }

            // Save state
            u.lastEmailSeq = u.seq;
            await u.save({ transaction: tx });
        }

        return false;
    });
}