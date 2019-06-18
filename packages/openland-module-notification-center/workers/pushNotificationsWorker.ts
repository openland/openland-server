import { inTx } from '@openland/foundationdb';
import { createLogger, withLogPath } from '@openland/log';
import { staticWorker } from '../../openland-module-workers/staticWorker';
import { Modules } from '../../openland-modules/Modules';
import { FDB } from '../../openland-module-db/FDB';
import { fetchMessageFallback } from '../../openland-module-messaging/resolvers/ModernMessage.resolver';

const Delays = {
    'none': 10 * 1000,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000
};

const log = createLogger('notification-center-push');

export function startPushNotificationWorker() {
    staticWorker({ name: 'notification_center_push_notifications', delay: 3000, startDelay: 3000 }, async (parent) => {
        let needDelivery = Modules.NotificationCenter.needDelivery;
        let unreadUsers = await inTx(parent, async (ctx) => await needDelivery.findAllUsersWithNotifications(ctx, 'push'));
        log.debug(parent, 'unread users: ' + unreadUsers.length);
        for (let uid of unreadUsers) {
            await inTx(parent, async (ctx) => {
                ctx = withLogPath(ctx, 'user ' + uid);

                // Loading user's settings and state
                let settings = await Modules.Users.getUserSettings(ctx, uid);
                let state = await Modules.NotificationCenter.getNotificationStateForUser(ctx, uid);

                let now = Date.now();

                let lastSeen = await Modules.Presence.getLastSeen(ctx, uid);
                let isActive = await Modules.Presence.isActive(ctx, uid);

                // Ignore never-online users
                if (lastSeen === 'never_online') {
                    log.debug(ctx, 'skip never-online');
                    needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    return;
                }

                // Ignore active users
                if (isActive) {
                    log.debug(ctx, 'skip active');
                    return;
                }

                // Pause notifications till 1 minute passes from last active timeout
                if (lastSeen > (now - Delays[settings.notificationsDelay || 'none'])) {
                    log.debug(ctx, 'skip delay');
                    return;
                }

                // Ignore read updates
                if (state.readSeq === state.seq) {
                    log.debug(ctx, 'ignore read updates');
                    needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    return;
                }

                // Ignore never opened apps
                if ((await Modules.Messaging.getUserNotificationState(ctx, uid)).readSeq === null) {
                    log.debug(ctx, 'ignore never opened apps');
                    needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    return;
                }

                // Ignore user's with disabled notifications
                if (settings.mobileNotifications === 'none' && settings.desktopNotifications === 'none') {
                    state.lastPushSeq = state.seq;
                    needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    log.debug(ctx, 'ignore user\'s with disabled notifications');
                    return;
                }

                if (settings.commentNotificationsDelivery === 'none') {
                    state.lastPushSeq = state.seq;
                    needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    log.debug(ctx, 'ignore user\'s with disabled notifications');
                    return;
                }

                // Ignore already processed updates
                if (state.lastPushSeq !== null && state.lastPushSeq >= state.seq) {
                    log.debug(ctx, 'ignore already processed updates');
                    needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    return;
                }

                // Scanning updates
                let afterSec = Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq ? state.readSeq : 0, state.lastPushSeq || 0);

                let remainingUpdates = await FDB.NotificationCenterEvent.allFromNotificationCenterAfter(ctx, state.ncid, afterSec);
                let notifications = remainingUpdates.filter((v) => v.kind === 'notification_received');

                // Handling unread messages
                let hasMessage = false;
                for (let m of notifications) {
                    if (m.seq <= afterSec) {
                        continue;
                    }

                    let notificationId = m.notificationId!;
                    let notification = await FDB.Notification.findById(ctx, notificationId);
                    if (!notification) {
                        continue;
                    }
                    let receiver = await Modules.Users.profileById(ctx, uid);
                    if (!receiver) {
                        continue;
                    }

                    let sendDesktop = settings.desktopNotifications !== 'none';
                    let sendMobile = settings.mobileNotifications !== 'none';

                    if (!sendMobile && !sendDesktop) {
                        continue;
                    }

                    hasMessage = true;

                    let title = '';
                    let pushBody = '';

                    if (notification.text) {
                        pushBody += notification.text;
                    }
                    if (notification.content) {
                        let commentNotification = notification.content.find(c => c.type === 'new_comment');
                        if (commentNotification) {
                            pushBody += 'New comment';
                            let comment = await FDB.Comment.findById(ctx, commentNotification.commentId);
                            let message = await FDB.Message.findById(ctx, comment!.peerId);
                            let chat = await FDB.Conversation.findById(ctx, message!.cid);
                            let chatName = await Modules.Messaging.room.resolveConversationTitle(ctx, chat!.id, uid);
                            let userName = await Modules.Users.getUserFullName(ctx, comment!.uid);

                            if (chat!.kind === 'private') {
                                pushBody = `${userName} commented: ${fetchMessageFallback(comment!)}`;
                            } else {
                                pushBody = `${userName} commented in @${chatName}: ${fetchMessageFallback(comment!)}`;
                            }
                        }
                    }

                    let push = {
                        uid: uid,
                        title: title,
                        body: pushBody,
                        picture: null,
                        counter: await FDB.UserCounter.byId(uid).get(ctx)!,
                        conversationId: null,
                        mobile: sendMobile,
                        desktop: sendDesktop,
                        mobileAlert: (settings.mobileAlert !== undefined && settings.mobileAlert !== null) ? settings.mobileAlert : true,
                        mobileIncludeText: (settings.mobileIncludeText !== undefined && settings.mobileIncludeText !== null) ? settings.mobileIncludeText : true,
                        silent: null
                    };

                    log.debug(ctx, 'new_push', JSON.stringify(push));
                    await Modules.Push.worker.pushWork(ctx, push);
                }

                // Save state
                if (hasMessage) {
                    state.lastPushNotification = Date.now();
                }

                log.debug(ctx, 'updated ' + state.lastPushSeq + '->' + state.seq);

                state.lastPushSeq = state.seq;
                needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
            });
        }
        return false;
    });
}
