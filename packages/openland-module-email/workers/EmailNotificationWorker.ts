import { staticWorker } from 'openland-module-workers/staticWorker';
import { DB, DB_SILENT } from '../../openland-server/tables';
import { Repos } from '../../openland-server/repositories';
import { Emails } from '../../openland-server/services/Emails';

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
            let tag = 'email_notifications ' + u.userId;

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
            if (settings.emailFrequency !== 'never') {

                // Read email timeouts
                let delta = 0;

                if (settings.emailFrequency === '1hour') {
                    delta = 60 * 60 * 1000;
                } else if (settings.emailFrequency === '15min') {
                    delta = 15 * 60 * 1000;
                } else if (settings.emailFrequency === '24hour') {
                    delta = 24 * 60 * 60 * 1000;
                } else if (settings.emailFrequency === '1week') {
                    delta = 7 * 24 * 60 * 60 * 1000;
                }

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
                    let message = await DB.ConversationMessage.findById(m.event.messageId as number, { transaction: tx });
                    if (!message) {
                        continue;
                    }

                    // disable email notificaitons for channels
                    let conversation = await DB.Conversation.findById(message.conversationId);
                    if (!conversation || conversation.type === 'channel') {
                        continue;
                    }

                    let conversationSettings = await Repos.Chats.getConversationSettings(u.userId, conversation.id);

                    if (conversationSettings.mute) {
                        continue;
                    }

                    if (!message.isMuted) {
                        hasNonMuted = true;
                    }
                }

                // Send email notification if there are some
                if (hasNonMuted) {
                    console.log(tag, 'new_email_notification');
                    await Emails.sendUnreadMesages(u.userId, u.unread, tx);
                    u.lastEmailNotification = new Date();
                }
            }

            // Save state
            u.lastEmailSeq = u.seq;
            await u.save({ transaction: tx });
        }
        return false;
    });
}