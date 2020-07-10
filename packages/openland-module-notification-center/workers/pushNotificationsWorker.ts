import { inTx } from '@openland/foundationdb';
import { createLogger, withLogPath } from '@openland/log';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import { fetchMessageFallback } from '../../openland-module-messaging/resolvers/ModernMessage.resolver';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { delay } from '@openland/foundationdb/lib/utils';
import { batch } from '../../openland-utils/batch';
import { plural } from '../../openland-utils/string';

const Delays = {
    'none': 10 * 1000,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000
};

const log = createLogger('notification-center-push');

export function startPushNotificationWorker() {
    singletonWorker({
        db: Store.storage.db,
        name: 'notification_center_push_notifications',
        delay: 3000,
        startDelay: 3000
    }, async (parent) => {
        let needDelivery = Modules.NotificationCenter.needDelivery;
        let unreadUsers = await inTx(parent, async (ctx) => await needDelivery.findAllUsersWithNotifications(ctx, 'push'));
        if (unreadUsers.length > 0) {
            log.debug(parent, 'unread users: ' + unreadUsers.length);
        } else {
            await delay(5000);
            return;
        }
        log.log(parent, 'found', unreadUsers.length, 'users');

        let batches = batch(unreadUsers, 10);

        for (let b of batches) {
            await inTx(parent, async (ctx) => {
                for (let uid of b) {
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
                    if (settings.mobile && settings.desktop) {
                        if (!settings.desktop.comments.showNotification && !settings.mobile.comments.showNotification) {
                            state.lastPushSeq = state.seq;
                            needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                            log.debug(ctx, 'ignore user\'s with disabled notifications');
                            return;
                        }
                    } else {
                        if (settings.mobileNotifications === 'none' && settings.desktopNotifications === 'none') {
                            state.lastPushSeq = state.seq;
                            needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                            log.debug(ctx, 'ignore user\'s with disabled notifications');
                            return;
                        }

                        if (!settings.commentNotificationsDelivery || settings.commentNotificationsDelivery === 'none') {
                            state.lastPushSeq = state.seq;
                            needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                            log.debug(ctx, 'ignore user\'s with disabled notifications');
                            return;
                        }
                    }

                    // Ignore already processed updates
                    if (state.lastPushSeq !== null && state.lastPushSeq >= state.seq) {
                        log.debug(ctx, 'ignore already processed updates');
                        needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                        return;
                    }

                    // Scanning updates
                    let afterSec = Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq ? state.readSeq : 0, state.lastPushSeq || 0);

                    let remainingUpdates = (await Store.NotificationCenterEvent.notificationCenter.query(ctx, state.ncid, {after: afterSec})).items;
                    let notifications = remainingUpdates.filter((v) => v.kind === 'notification_received');

                    // Handling unread messages
                    let hasMessage = false;
                    for (let m of notifications) {
                        if (m.seq <= afterSec) {
                            continue;
                        }

                        let notificationId = m.notificationId!;
                        let notification = await Store.Notification.findById(ctx, notificationId);
                        if (!notification) {
                            continue;
                        }
                        let receiver = await Modules.Users.profileById(ctx, uid);
                        if (!receiver) {
                            continue;
                        }

                        let sendDesktop = settings.desktop ? settings.desktop.comments.showNotification : settings.desktopNotifications !== 'none';
                        let sendMobile = settings.mobile ? settings.mobile.comments.showNotification : settings.mobileNotifications !== 'none';

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
                            if (commentNotification && commentNotification.type === 'new_comment') {
                                pushBody += 'New comment';
                                let comment = await Store.Comment.findById(ctx, commentNotification.commentId);
                                let message = await Store.Message.findById(ctx, comment!.peerId);
                                let chat = await Store.Conversation.findById(ctx, message!.cid);
                                let chatName = await Modules.Messaging.room.resolveConversationTitle(ctx, chat!.id, uid);
                                let userName = await Modules.Users.getUserFullName(ctx, comment!.uid);

                                if (chat!.kind === 'private') {
                                    pushBody = `${userName} commented: ${await fetchMessageFallback(comment!)}`;
                                } else {
                                    pushBody = `${userName} commented in @${chatName}: ${await fetchMessageFallback(comment!)}`;
                                }
                            }

                            let matchmakingProfileNotification = notification.content.find(a => a.type === 'new_matchmaking_profiles');
                            if (matchmakingProfileNotification && matchmakingProfileNotification.type === 'new_matchmaking_profiles') {
                                let userNames = await Promise
                                    .all(matchmakingProfileNotification.uids.map(async a => await Modules.Users.getUserFullName(ctx, a)));

                                pushBody = `New member ${plural(userNames.length, ['profile', 'profiles'])} from ${userNames[0]}`;
                                if (userNames.length > 1) {
                                    pushBody += ` and ${userNames.length === 2 ? userNames[1] : `${userNames.length - 1} others.`}`;
                                }
                            }
                        }

                        let deprecatedMobileAlert = (settings.mobileAlert !== undefined && settings.mobileAlert !== null) ? settings.mobileAlert : true;
                        let push = {
                            uid: uid,
                            title: title,
                            body: pushBody,
                            picture: null,
                            counter: await Modules.Messaging.fetchUserGlobalCounter(ctx, uid),
                            conversationId: null,
                            deepLink: null,
                            mobile: sendMobile,
                            desktop: sendDesktop,
                            mobileAlert: settings.mobile ? settings.mobile.comments.sound : deprecatedMobileAlert,
                            mobileIncludeText: settings.mobile ? settings.mobile.notificationPreview === 'name_text' : true,
                            silent: null
                        };

                        log.debug(ctx, 'new_push', JSON.stringify(push));
                        await Modules.Push.worker.pushWork(ctx, [push]);
                    }

                    // Save state
                    if (hasMessage) {
                        state.lastPushNotification = Date.now();
                    }

                    log.debug(ctx, 'updated ' + state.lastPushSeq + '->' + state.seq);

                    state.lastPushSeq = state.seq;
                    needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                }
            });
        }
    });
}
