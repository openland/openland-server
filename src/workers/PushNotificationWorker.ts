import { staticWorker } from '../modules/staticWorker';
import { DB } from '../tables';
import { PushWorker } from '.';
import { Repos } from '../repositories';

export function startPushNotificationWorker() {
    staticWorker({ name: 'push_notifications', delay: 1000 }, async (tx) => {
        let unreadUsers = await DB.ConversationsUserGlobal.findAll({
            where: {
                unread: { $gt: 0 }
            },
            transaction: tx,
            lock: tx.LOCK.UPDATE
        });
        // let now = Date.now();
        for (let u of unreadUsers) {
            let lastSeen = await Repos.Users.getUserLastSeen(u.userId, tx);
            // if ((lastSeen !== null && lastSeen < now - 60 * 1000) && (u.lastEmailNotification === null || u.lastEmailNotification.getTime() < now - 60 * 60 * 1000) && (u.lastEmailNotification === null || u.lastEmailNotification.getTime() < lastSeen || u.lastEmailNotification.getTime() < now - 24 * 60 * 60 * 1000)) {
            //     u.lastEmailNotification = new Date();
            //     u.save({ transaction: tx });
            //     await Emails.sendUnreadMesages(u.userId, u.unread, tx);
            // }
            if ((lastSeen !== null) && (u.lastPushNotification === null || u.lastPushNotification.getTime() < lastSeen)) {
                u.lastPushNotification = new Date();
                await u.save({ transaction: tx });
                await PushWorker.pushWork({ uid: u.userId, title: 'New message', body: 'You have ' + u.unread + ' unread messages' }, tx);
            }
        }

        return false;
    });
}