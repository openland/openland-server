import { staticWorker } from '../modules/staticWorker';
import { DB, DB_SILENT } from '../tables';
import { Repos } from '../repositories';
import { Emails } from '../services/Emails';

export function startEmailNotificationWorker() {
    staticWorker({ name: 'email_notifications', delay: 15000 }, async (tx) => {
        console.log('email_notifications start');
        let unreadUsers = await DB.ConversationsUserGlobal.findAll({
            where: {
                unread: { $gt: 0 }
            },
            transaction: tx,
            lock: tx.LOCK.UPDATE
        });
        let now = Date.now();
        console.log('email_notifications users: ' + unreadUsers.length);

        for (let u of unreadUsers) {
            let lastSeen = await Repos.Users.getUserLastSeen(u.userId, tx);
            let tag = 'email_notifications ' + u.userId;
            console.log(tag, lastSeen, JSON.stringify(u));

            // Ignore online or never-online users
            if (lastSeen === null) {
                continue;
            }

            // Ignore recently online users
            if (lastSeen > now - 5 * 60 * 1000) {
                continue;
            }

            // Ignore never opened apps
            if (u.readSeq === null) {
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

            let settings = await Repos.Users.getUserSettings(u.userId);
            console.log(tag, lastSeen, JSON.stringify(settings));
            if (settings.emailFrequency !== 'never') {

                // Read email timeouts
                let delta = settings.emailFrequency === '1hour' ? 60 * 60 * 1000 : 15 * 60 * 1000;

                // Do not send emails more than one in an hour
                if (u.lastEmailNotification !== null && u.lastEmailNotification.getTime() > now - delta) {
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
                    logging: DB_SILENT
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
                    console.log(tag, 'new_email_notification');
                    await Emails.sendUnreadMesages(u.userId, u.unread, tx);
                }
            }

            // Save state
            u.lastEmailSeq = u.seq;
            await u.save({ transaction: tx });
        }
        console.log('email_notifications end');

        return false;
    });
}