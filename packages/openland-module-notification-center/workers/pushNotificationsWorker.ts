import { inTx } from '@openland/foundationdb';
import { createLogger, withLogPath } from '@openland/log';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import { fetchMessageFallback } from '../../openland-module-messaging/resolvers/ModernMessage.resolver';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { batch } from '../../openland-utils/batch';
import { IDs } from '../../openland-module-api/IDs';
import { Push } from '../../openland-module-push/workers/types';
import { Context, createNamedContext } from '@openland/context';
import { NotificationCenterEvent, NotificationCenterState, UserSettingsShape } from '../../openland-module-db/store';

// const Delays = {
//     'none': 10 * 1000,
//     '1min': 60 * 1000,
//     '15min': 15 * 60 * 1000
// };

type User = {
    uid: number;
    status: {
        lastSeen: 'online' | 'never_online' | number;
        isActive: boolean;
    },
    state: NotificationCenterState,
    settings: UserSettingsShape
};

const log = createLogger('notification-center-push');
const rootCtx = createNamedContext('notification-center-push');
const DEBUG = false;

function shouldIgnoreUser(ctx: Context, user: User) {
    let {
        status,
        settings,
        state
    } = user;

    // Ignore never-online users
    if (status.lastSeen === 'never_online') {
        DEBUG && log.debug(ctx, 'skip never-online');
        return true;
    }

    // Ignore active users
    if (status.isActive) {
        DEBUG && log.debug(ctx, 'skip active');
        return true;
    }

    // Ignore read updates
    if (state.readSeq === state.seq) {
        DEBUG && log.debug(ctx, 'ignore read updates');
        return true;
    }

    // Ignore user's with disabled notifications
    if (settings.mobile && settings.desktop) {
        if (!settings.desktop.comments.showNotification && !settings.mobile.comments.showNotification) {
            DEBUG && log.debug(ctx, 'ignore user\'s with disabled notifications');
            return true;
        }
    }

    // Ignore already processed updates
    if (state.lastPushSeq !== null && state.lastPushSeq >= state.seq) {
        DEBUG && log.debug(ctx, 'ignore already processed updates');
        return true;
    }

    return false;
}

async function handleNotification(ctx: Context, uid: number, settings: UserSettingsShape, event: NotificationCenterEvent) {
    let notificationId = event.notificationId!;
    let notification = await Store.Notification.findById(ctx, notificationId);
    if (!notification) {
        return false;
    }

    let sendDesktop = settings.desktop ? settings.desktop.comments.showNotification : settings.desktopNotifications !== 'none';
    let sendMobile = settings.mobile ? settings.mobile.comments.showNotification : settings.mobileNotifications !== 'none';

    if (!sendMobile && !sendDesktop) {
        return false;
    }

    let title = {
        EN: '',
        RU: ''
    };
    let pushBody = {
        EN: '',
        RU: ''
    };

    if (notification.text) {
        pushBody.EN += notification.text;
        pushBody.RU += notification.text;
    }

    if (notification.content) {
        let commentNotification = notification.content.find(c => c.type === 'new_comment');
        if (commentNotification && commentNotification.type === 'new_comment') {
            let comment = await Store.Comment.findById(ctx, commentNotification.commentId);
            let message = await Store.Message.findById(ctx, comment!.peerId);
            let chat = await Store.Conversation.findById(ctx, message!.cid);
            let chatName = await Modules.Messaging.room.resolveConversationTitle(ctx, chat!.id, uid);
            let userName = await Modules.Users.getUserFullName(ctx, comment!.uid);

            if (chat!.kind === 'private') {
                title = {
                    EN: 'New comment',
                    RU: 'Новый комментарий'
                };
            } else {
                title = {
                    EN: 'New comment in ' + chatName,
                    RU: 'Новый комментарий: ' + chatName
                };
            }
            pushBody = {
                EN: `${userName}: ${await fetchMessageFallback(ctx, 'EN', comment!)}`,
                RU: `${userName}: ${await fetchMessageFallback(ctx, 'RU', comment!)}`
            };
        }
    }

    let deprecatedMobileAlert = (settings.mobileAlert !== undefined && settings.mobileAlert !== null) ? settings.mobileAlert : true;
    let push: Push = {
        uid: uid,
        title: title.EN,
        titleMultiLang: title,
        body: pushBody.EN,
        bodyMultiLang: pushBody,
        picture: null,
        counter: await Modules.Messaging.counters.fetchUserGlobalCounter(ctx, uid),
        conversationId: null,
        deepLink: null,
        mobile: sendMobile,
        desktop: sendDesktop,
        mobileAlert: settings.mobile ? settings.mobile.comments.sound : deprecatedMobileAlert,
        mobileIncludeText: settings.mobile ? settings.mobile.notificationPreview === 'name_text' : true,
        silent: null,
        messageId: null,
        commentId: null,
    };

    let commentContent = notification.content?.find(c => c.type === 'new_comment');
    if (commentContent && commentContent.type === 'new_comment') {
        let comment = (await Store.Comment.findById(ctx, commentContent.commentId))!;
        if (comment.peerType === 'message') {
            push.messageId = IDs.ConversationMessage.serialize(comment.peerId);
            push.commentId = IDs.Comment.serialize(comment.id);
        }
    }

    DEBUG && log.debug(ctx, 'new_push', JSON.stringify(push));
    Modules.Push.worker.pushWork(ctx, push);
    return true;
}

async function handleUser(ctx: Context, uid: number) {
    ctx = withLogPath(ctx, 'user ' + uid);

    // Loading user's settings and state
    let [settings, state, status] = await Promise.all([
        Modules.Users.getUserSettings(ctx, uid),
        Modules.NotificationCenter.getNotificationStateForUser(ctx, uid),
        Modules.Presence.getStatusInTx(ctx, uid),
    ]);

    let user = {
        uid,
        settings,
        state,
        status
    };

    if (shouldIgnoreUser(ctx, user)) {
        Modules.NotificationCenter.needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
        state.lastPushSeq = state.seq;
    }

    // Scanning updates
    let afterSec = Math.max(state.lastEmailSeq || 0, state.readSeq || 0, state.lastPushSeq || 0);

    let remainingUpdates = (await Store.NotificationCenterEvent.notificationCenter.query(ctx, state.ncid, { after: afterSec })).items;
    let notifications = remainingUpdates.filter((v) => v.kind === 'notification_received');

    // Handling unread notifications
    let res = await Promise.all(notifications.map(ev => handleNotification(ctx, uid, settings, ev)));
    let hasPush = res.some(v => v === true);

    // Save state
    if (hasPush) {
        state.lastPushNotification = Date.now();
    }

    log.debug(ctx, 'updated ' + state.lastPushSeq + '->' + state.seq);

    state.lastPushSeq = state.seq;
    Modules.NotificationCenter.needDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
}

export function startPushNotificationWorker() {
    singletonWorker({
        db: Store.storage.db,
        name: 'notification_center_push_notifications',
        delay: 1000,
        startDelay: 3000
    }, async (parent) => {
        let unreadUsers = await inTx(parent, async (ctx) => await Modules.NotificationCenter.needDelivery.findAllUsersWithNotifications(ctx, 'push'));
        if (unreadUsers.length > 0) {
            log.debug(parent, 'unread users: ' + unreadUsers.length);
        } else {
            return;
        }

        log.log(parent, 'found', unreadUsers.length, 'users');

        let batches = batch(unreadUsers.slice(0, 1000), 10);

        for (let b of batches) {
            try {
                await inTx(parent, async ctx => {
                    await Promise.all(b.map(uid => handleUser(ctx, uid)));
                });
            } catch (e) {
                log.log(rootCtx, 'error', e);
            }
        }
    });
}
