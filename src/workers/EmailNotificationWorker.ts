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
            if ((lastSeen !== null && lastSeen < now - 5 * 60 * 1000) && (u.lastEmailNotification === null || u.lastEmailNotification.getTime() < now - 60 * 60 * 1000) && (u.lastEmailNotification === null || u.lastEmailNotification.getTime() < lastSeen || u.lastEmailNotification.getTime() < now - 24 * 60 * 60 * 1000)) {
                u.lastEmailNotification = new Date();
                await u.save({ transaction: tx });
                await Emails.sendUnreadMesages(u.userId, u.unread, tx);
            }
        }

        return false;
    });
}