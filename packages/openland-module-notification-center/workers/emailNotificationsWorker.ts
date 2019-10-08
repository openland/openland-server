import { inTx } from '@openland/foundationdb';
import { createLogger } from '@openland/log';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import { Comment } from '../../openland-module-db/store';
import { Emails } from '../../openland-module-email/Emails';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { delay } from '@openland/foundationdb/lib/utils';
import { batch } from '../../openland-utils/batch';

const Delays = {
    '15min': 15 * 60 * 1000,
    '1hour': 60 * 60 * 1000,
    '24hour': 24 * 60 * 60 * 1000,
    '1week': 7 * 24 * 60 * 60 * 1000,
};

const log = createLogger('notification_center_email');

export function startEmailNotificationWorker() {
    singletonWorker({
        name: 'notification_center_email_notifications',
        db: Store.storage.db,
        delay: 15000,
        startDelay: 3000
    }, async (parent) => {
        let needDelivery = Modules.NotificationCenter.needDelivery;
        let unreadUsers = await inTx(parent, async (ctx) => await needDelivery.findAllUsersWithNotifications(ctx, 'email'));
        if (unreadUsers.length > 0) {
            log.debug(parent, 'unread users: ' + unreadUsers.length);
        } else {
            await delay(5000);
            return;
        }
        let now = Date.now();
        log.log(parent, 'found', unreadUsers.length, 'users');

        let batches = batch(unreadUsers, 10);

        for (let b of batches) {
            await inTx(parent, async (ctx) => {
                for (let uid of b) {
                    let state = await Modules.NotificationCenter.getNotificationStateForUser(ctx, uid);
                    let lastSeen = await Modules.Presence.getLastSeen(ctx, uid);
                    let isActive = await Modules.Presence.isActive(ctx, uid);
                    let tag = 'email_notifications ' + uid;

                    // Ignore active users
                    if (isActive) {
                        log.debug(ctx, 'skip active');
                        return;
                    }

                    // Ignore never online
                    if (lastSeen === 'never_online') {
                        log.debug(ctx, 'skip never-online');
                        needDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
                        return;
                    }

                    // Ignore recently online users
                    if (lastSeen === 'online' || (lastSeen > now - 5 * 60 * 1000)) {
                        log.debug(ctx, 'skip recently online');
                        return;
                    }

                    // Ignore never opened apps
                    if ((await Modules.Messaging.getUserNotificationState(ctx, uid)).readSeq === null) {
                        log.debug(ctx, 'ignore never opened apps');
                        needDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
                        return;
                    }

                    // Ignore read updates
                    if (state.readSeq === state.seq) {
                        log.debug(ctx, 'ignore read updates');
                        needDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
                        return;
                    }

                    // Ignore already processed updates
                    if (state.lastEmailSeq === state.seq) {
                        log.debug(ctx, 'ignore already processed updates');
                        needDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
                        return;
                    }

                    let settings = await Modules.Users.getUserSettings(ctx, uid);

                    if (settings.emailFrequency === 'never') {
                        log.debug(ctx, 'ignore emailFrequency = never');
                        return;
                    }

                    if (!settings.commentNotificationsDelivery || settings.commentNotificationsDelivery === 'none') {
                        state.lastPushSeq = state.seq;
                        needDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
                        log.debug(ctx, 'ignore user\'s with disabled notifications');
                        return;
                    }

                    // Read email timeouts
                    let delta = Delays[settings.emailFrequency];

                    // Do not send emails more than one in an hour
                    if (state.lastEmailNotification !== null && state.lastEmailNotification > now - delta) {
                        log.debug(ctx, 'Do not send emails more than one in an hour');
                        return;
                    }

                    // Fetch pending updates
                    let afterSeq = Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq ? state.readSeq : 0);
                    let remainingUpdates = (await Store.NotificationCenterEvent.notificationCenter.query(ctx, state.ncid, {after: afterSeq})).items;
                    let notifications = remainingUpdates.filter((v) => v.kind === 'notification_received');

                    let unreadComments: Comment[] = [];

                    for (let m of notifications) {
                        let notification = await Store.Notification.findById(ctx, m.notificationId!);
                        if (!notification) {
                            continue;
                        }

                        let newComment = notification.content && notification.content.find(c => c.type === 'new_comment');
                        if (newComment && newComment.type === 'new_comment') {
                            unreadComments.push((await Store.Comment.findById(ctx, newComment.commentId))!);
                        }
                    }

                    // Send email notification if there are some
                    if (unreadComments.length > 0) {
                        log.log(ctx, tag, 'new_email_notification');
                        await Emails.sendUnreadComments(ctx, uid, unreadComments);
                        state.lastEmailNotification = Date.now();
                    }

                    // Save state
                    state.lastEmailSeq = state.seq;
                    needDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
                }
            });
        }
    });
}