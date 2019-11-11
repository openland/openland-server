import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Texts } from '../texts';
import { fetchMessageFallback } from 'openland-module-messaging/resolvers/ModernMessage.resolver';
import { createLogger, withLogPath } from '@openland/log';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { delay } from '@openland/foundationdb/lib/utils';
import { Context } from '@openland/context';
import { batch } from '../../openland-utils/batch';
import { eventsFind } from '../../openland-module-db/eventsFind';
import { UserDialogMessageReceivedEvent } from '../../openland-module-db/store';

const Delays = {
    'none': 10 * 1000,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000,
};

const log = createLogger('push');

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

    let now = Date.now();
    // Pause notifications till 1 minute passes from last active timeout
    if (user.lastSeen > (now - Delays[user.notificationsDelay || 'none'])) {
        log.debug(ctx, 'skip delay');
        return true;
    }

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

const handleUser = async (_ctx: Context, uid: number) => {
    let ctx = withLogPath(_ctx, 'user ' + uid);

    // Loading user's settings and state
    let settings = await Modules.Users.getUserSettings(ctx, uid);
    let state = await Modules.Messaging.getUserNotificationState(ctx, uid);
    let lastSeen = await Modules.Presence.getLastSeen(ctx, uid);
    let isActive = await Modules.Presence.isActive(ctx, uid);

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
        await Modules.Push.sendCounterPush(ctx, uid);
        Modules.Messaging.needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
        state.lastPushCursor = await Store.UserDialogEventStore.createStream(uid, { batchSize: 1 }).tail(ctx);
        return;
    }

    // Scanning updates
    // let cursors = [
    //     Buffer.from(state.lastPushCursor || '', 'base64'),
    //     Buffer.from(state.lastEmailCursor || '', 'base64')
    // ].sort(Buffer.compare);
    // let after = cursors[cursors.length - 1].toString('base64');
    let after = state.lastPushCursor || '';

    let updates = await eventsFind(ctx, Store.UserDialogEventStore, [uid], { afterCursor: after });
    let messages = updates.items.filter(e => e.event instanceof UserDialogMessageReceivedEvent).map(e => e.event as UserDialogMessageReceivedEvent);

    let unreadCounter: number = await Modules.Messaging.fetchUserGlobalCounter(ctx, uid);

    // Handling unread messages
    let hasPush = false;
    for (let m of messages) {
        let messageId = m.mid!;
        let message = await Store.Message.findById(ctx, messageId);
        if (!message) {
            continue;
        }

        // Ignore current user
        if (message.uid === uid) {
            continue;
        }

        let readMessageId = await Store.UserDialogReadMessageId.get(ctx, uid, message.cid);
        // Ignore read messages
        if (readMessageId >= message.id) {
            continue;
        }

        let sender = await Modules.Users.profileById(ctx, message.uid);
        let receiver = await Modules.Users.profileById(ctx, uid);
        let conversation = await Store.Conversation.findById(ctx, message.cid);

        if (!sender || !receiver || !conversation) {
            continue;
        }

        let messageSettings = await Modules.Messaging.getSettingsForMessage(ctx, uid, m.mid);
        let sendMobile = messageSettings.mobile.showNotification;
        let sendDesktop = messageSettings.desktop.showNotification;

        if (!sendMobile && !sendDesktop) {
            continue;
        }

        let chatTitle = await Modules.Messaging.room.resolveConversationTitle(ctx, conversation.id, uid);

        if (chatTitle.startsWith('@')) {
            chatTitle = chatTitle.slice(1);
        }

        hasPush = true;
        let senderName = await Modules.Users.getUserFullName(ctx, sender.id);
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
    }

    // Save state
    if (hasPush) {
        state.lastPushNotification = Date.now();
    } else {
        await Modules.Push.sendCounterPush(ctx, uid);
    }

    state.lastPushCursor = await Store.UserDialogEventStore.createStream(uid, { batchSize: 1 }).tail(ctx);
    Modules.Messaging.needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
};

export function startPushNotificationWorker() {
    singletonWorker({
        name: 'push_notifications',
        delay: 3000,
        startDelay: 3000,
        db: Store.storage.db
    }, async (parent) => {
        let unreadUsers = await inTx(parent, async (ctx) => await Modules.Messaging.needNotificationDelivery.findAllUsersWithNotifications(ctx, 'push'));
        if (unreadUsers.length > 0) {
            log.debug(parent, 'unread users: ' + unreadUsers.length);
        } else {
            await delay(5000);
            return;
        }
        log.log(parent, 'found', unreadUsers.length, 'users');

        let batches = batch(unreadUsers, 10);
        await Promise.all(batches.map(b => inTx(parent, async (c) => {
            await Promise.all(b.map(uid => handleUser(c, uid)));
        })));
    });
}