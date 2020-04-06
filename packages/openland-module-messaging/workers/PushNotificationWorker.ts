import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Texts } from '../texts';
import { fetchMessageFallback } from 'openland-module-messaging/resolvers/ModernMessage.resolver';
import { createLogger, withLogPath } from '@openland/log';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { Context, createNamedContext } from '@openland/context';
import { eventsFind } from '../../openland-module-db/eventsFind';
import { UserDialogMessageReceivedEvent, UserSettings } from '../../openland-module-db/store';
import { batch } from '../../openland-utils/batch';
import { createHyperlogger } from '../../openland-module-hyperlog/createHyperlogEvent';

// const Delays = {
//     'none': 10 * 1000,
//     '1min': 60 * 1000,
//     '15min': 15 * 60 * 1000,
// };

const log = createLogger('push');
const rootCtx = createNamedContext('push');

export const shouldIgnoreUser = (ctx: Context, user: {
    lastSeen: 'online' | 'never_online' | number,
    isActive: boolean,
    notificationsDelay: '1min' | '15min' | 'none' | null,
    lastPushCursor: string | null,
    eventsTail: string | null,
    mobileNotifications: 'all' | 'direct' | 'none',
    desktopNotifications: 'all' | 'direct' | 'none'
}) => {
    if (user.lastSeen === 'never_online') {
        log.debug(ctx, 'skip never-online');
        return true;
    }

    // Ignore active users
    if (user.isActive) {
        log.debug(ctx, 'skip active');
        return true;
    }

    // let now = Date.now();
    // Pause notifications till 1 minute passes from last active timeout
    // if (user.lastSeen > (now - Delays[user.notificationsDelay || 'none'])) {
    //     log.debug(ctx, 'skip delay');
    //     return true;
    // }

    // Ignore user's with disabled notifications
    if (user.mobileNotifications === 'none' && user.desktopNotifications === 'none') {
        log.debug(ctx, 'ignore user\'s with disabled notifications');
        return true;
    }

    // Ignore already sent pushes
    if (user.lastPushCursor && user.eventsTail) {
        let comp = Buffer.compare(Buffer.from(user.lastPushCursor, 'base64'), Buffer.from(user.eventsTail, 'base64'));
        if (comp === 0) {
            log.debug(ctx, 'ignore already processed updates');
            return true;
        }
    }
    return false;
};

const handleMessage = async (ctx: Context, uid: number, unreadCounter: number, settings: UserSettings, event: UserDialogMessageReceivedEvent) => {
    log.log(ctx, 'handle message', event.mid);

    let [
        message,
        readMessageId,
        conversation,
    ] = await Promise.all([
        Store.Message.findById(ctx, event.mid),
        Store.UserDialogReadMessageId.get(ctx, uid, event.cid),
        Store.Conversation.findById(ctx, event.cid)
    ]);

    if (!message) {
        log.debug(ctx, 'Message not found');
        return false;
    }

    // Ignore current user
    if (message.uid === uid) {
        log.debug(ctx, 'Ignore current user');
        return false;
    }

    log.debug(ctx, 'readMessageId', readMessageId);
    // Ignore read messages
    if (readMessageId && (readMessageId >= message.id)) {
        log.debug(ctx, 'Ignore read messages');
        return false;
    }

    if (!conversation) {
        log.debug(ctx, 'Conversation not found');
        return false;
    }

    let sender = await Modules.Users.profileById(ctx, message.uid);

    if (!sender) {
        log.debug(ctx, 'Sender not found');
        return false;
    }

    let messageSettings = await Modules.Messaging.getSettingsForMessage(ctx, uid, event.mid);
    let sendMobile = messageSettings.mobile.showNotification;
    let sendDesktop = messageSettings.desktop.showNotification;

    if (!sendMobile && !sendDesktop) {
        log.debug(ctx, 'Ignore disabled pushes');
        return false;
    }

    let [chatTitle, senderName] = await Promise.all([
        Modules.Messaging.room.resolveConversationTitle(ctx, conversation.id, uid),
        Modules.Users.getUserFullName(ctx, sender.id)
    ]);

    if (chatTitle.startsWith('@')) {
        chatTitle = chatTitle.slice(1);
    }

    let pushTitle = Texts.Notifications.GROUP_PUSH_TITLE({senderName, chatTitle});

    if (conversation.kind === 'private') {
        pushTitle = chatTitle;
    }

    if (message.isService) {
        pushTitle = chatTitle;
    }

    let pushBody = await fetchMessageFallback(message);

    let push = {
        uid: uid,
        title: pushTitle,
        body: pushBody,
        picture: sender.picture ? buildBaseImageUrl(sender.picture!!) : null,
        counter: unreadCounter,
        conversationId: conversation.id,
        deepLink: null,
        mobile: sendMobile,
        desktop: sendDesktop,
        mobileAlert: messageSettings.mobile.sound,
        mobileIncludeText: settings.mobile ? settings.mobile.notificationPreview === 'name_text' : true,
        silent: null,
    };

    if (sendMobile) {
        Modules.Hooks.onMobilePushSent(ctx, uid);
    }
    if (sendDesktop) {
        Modules.Hooks.onDesktopPushSent(ctx, uid);
    }

    log.debug(ctx, 'new_push', JSON.stringify(push));
    await Modules.Push.pushWork(ctx, push);
    return true;
};

const handleUser = async (root: Context, uid: number) => {
    return await inTx(root, async _ctx => {
        let ctx = withLogPath(_ctx, 'user ' + uid);

        // Loading user's settings and state
        let [settings, state, lastSeen, isActive] = await Promise.all([
            Modules.Users.getUserSettings(ctx, uid),
            Modules.Messaging.getUserNotificationState(ctx, uid),
            Modules.Presence.getLastSeen(ctx, uid),
            await Modules.Presence.isActive(ctx, uid)
        ]);

        const user = {
            uid,
            lastSeen,
            isActive,
            notificationsDelay: settings.notificationsDelay,
            lastPushCursor: state.lastPushCursor,
            eventsTail: await Store.UserDialogEventStore.createStream(uid, { batchSize: 1 }).tail(ctx),
            mobileNotifications: settings.mobileNotifications,
            desktopNotifications: settings.desktopNotifications,
        };

        if (shouldIgnoreUser(ctx, user)) {
            log.debug(ctx, 'ignored');
            await Modules.Push.sendCounterPush(ctx, uid);
            Modules.Messaging.needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
            state.lastPushCursor = await Store.UserDialogEventStore.createStream(uid, { batchSize: 1 }).tail(ctx);
            return;
        }

        let [updates, unreadCounter] = await Promise.all([
            eventsFind(ctx, Store.UserDialogEventStore, [uid], { afterCursor: state.lastPushCursor || '' }),
            Modules.Messaging.fetchUserGlobalCounter(ctx, uid)
        ]);

        let messages = updates.items.filter(e => e.event instanceof UserDialogMessageReceivedEvent).map(e => e.event as UserDialogMessageReceivedEvent);
        log.log(ctx, messages.length, 'messages found');

        // Handling unread messages
        let res = await Promise.all(messages.map(m => handleMessage(ctx, uid, unreadCounter, settings, m)));
        let hasPush = res.some(v => v === true);

        // Save state
        if (hasPush) {
            state.lastPushNotification = Date.now();
        } else {
            log.debug(ctx, 'send counter');
            await Modules.Push.sendCounterPush(ctx, uid);
        }

        state.lastPushCursor = await Store.UserDialogEventStore.createStream(uid, { batchSize: 1 }).tail(ctx);
        Modules.Messaging.needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
    });
};

const onMessageNotificationsHandled = createHyperlogger<{ usersCount: number, duration: number }>('message_notifications_handled');

export function startPushNotificationWorker() {
    singletonWorker({
        name: 'push_notifications',
        delay: 3000,
        startDelay: 3000,
        db: Store.storage.db
    }, async (parent) => {
        let startTime = Date.now();
        let unreadUsers = await inTx(parent, async (ctx) => await Modules.Messaging.needNotificationDelivery.findAllUsersWithNotifications(ctx, 'push'));
        if (unreadUsers.length > 0) {
            log.debug(parent, 'unread users: ' + unreadUsers.length, JSON.stringify(unreadUsers));
        } else {
            return;
        }
        log.log(parent, 'found', unreadUsers.length, 'users');

        let batches = batch(unreadUsers, 10);

        for (let b of batches) {
            try {
                await inTx(rootCtx, async ctx => {
                    await Promise.all(b.map(uid => handleUser(ctx, uid)));
                });
            } catch (e) {
                log.log(rootCtx, 'push_error', e);
            }
        }
        await inTx(parent, async ctx => {
            await onMessageNotificationsHandled.event(ctx, { usersCount: unreadUsers.length, duration: Date.now() - startTime });
        });
    });
}
