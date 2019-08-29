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
    notificationsReadSeq: number | null,
    userStateSeq: number,
    lastPushSeq: number | null,
    lastPushCursor: string | null,
    eventsTail: string | null,
    mobileNotifications: 'all' | 'direct' | 'none',
    desktopNotifications: 'all' | 'direct' | 'none'
}) => {

    if (user.lastSeen === 'never_online') {
        log.debug(ctx, 'skip never-online');
        return true;
    }

    // // Pause notifications only if delay was set
    // // if (settings.notificationsDelay !== 'none') {
    // // Ignore online
    // if (lastSeen === 'online') {
    //     log.debug(ctx, 'skip online');
    //     return;
    // }

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

    // Ignore read updates
    if (user.notificationsReadSeq === user.userStateSeq) {
        log.debug(ctx, 'ignore read updates');
        return true;
    }

    // Ignore never opened apps
    if (user.notificationsReadSeq === null) {
        log.debug(ctx, 'ignore never opened apps');
        return true;
    }

    // Ignore user's with disabled notifications
    if (user.mobileNotifications === 'none' && user.desktopNotifications === 'none') {
        log.debug(ctx, 'ignore user\'s with disabled notifications');
        return true;
    }

    // Ignore already processed updates
    // if (user.lastPushSeq !== null && user.lastPushSeq >= user.userStateSeq) {
    //     log.debug(ctx, 'ignore already processed updates');
    //     return true;
    // }
    if (user.lastPushCursor && user.eventsTail) {
        let comp = Buffer.compare(Buffer.from(user.lastPushCursor, 'base64'), Buffer.from(user.eventsTail, 'base64'));
        if (comp === 0) {
            log.debug(ctx, 'ignore already processed updates');
            return true;
        }
    }
    return false;
};

export const shouldResetNotificationDelivery = (ctx: Context, user: {
    uid: number,
    lastSeen: 'online' | 'never_online' | number,
    notificationsReadSeq: number | null,
    userStateSeq: number,
    lastPushSeq: number | null,
    mobileNotifications: 'all' | 'direct' | 'none',
    desktopNotifications: 'all' | 'direct' | 'none'
}) => {
    return user.lastSeen === 'never_online'
        || user.notificationsReadSeq === user.userStateSeq // Ignore read updates
        || user.notificationsReadSeq === null // Ignore never opened apps
        || (user.mobileNotifications === 'none' && user.desktopNotifications === 'none') // Ignore user's with disabled notifications
        || (user.lastPushSeq !== null && user.lastPushSeq >= user.userStateSeq);  // Ignore already processed updates
};

export const shouldUpdateUserSeq = (ctx: Context, user: {
    mobileNotifications: 'all' | 'direct' | 'none',
    desktopNotifications: 'all' | 'direct' | 'none',
}) => {
    if (user.mobileNotifications === 'none' && user.desktopNotifications === 'none') {
        return true;
    }
    return false;
};

const handleUser = async (_ctx: Context, uid: number) => {
    let ctx = withLogPath(_ctx, 'user ' + uid);

    log.debug(ctx, 'kek');
    // Loading user's settings and state

    let ustate = await Modules.Messaging.getUserMessagingState(ctx, uid);
    let settings = await Modules.Users.getUserSettings(ctx, uid);
    let state = await Modules.Messaging.getUserNotificationState(ctx, uid);
    let lastSeen = await Modules.Presence.getLastSeen(ctx, uid);
    let isActive = await Modules.Presence.isActive(ctx, uid);

    const user = {
        uid,
        lastSeen,
        isActive,
        notificationsDelay: settings.notificationsDelay,
        notificationsReadSeq: state.readSeq,
        userStateSeq: ustate.seq,
        lastPushCursor: state.lastPushCursor,
        lastPushSeq: state.lastPushSeq,
        eventsTail: await Store.UserDialogEventStore.createStream(uid, { batchSize: 1 }).tail(ctx),
        mobileNotifications: settings.mobileNotifications,
        desktopNotifications: settings.desktopNotifications,
    };

    if (shouldIgnoreUser(ctx, user)) {
        await Modules.Push.sendCounterPush(ctx, uid);

        // if (shouldResetNotificationDelivery(ctx, user)) {
        Modules.Messaging.needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
        // }
        // if (shouldUpdateUserSeq(ctx, user)) {
        //     state.lastPushSeq = ustate.seq;
        // }
        state.lastPushCursor = await Store.UserDialogEventStore.createStream(uid, { batchSize: 1 }).tail(ctx);
        return;
    }

    // Scanning updates
    let cursors = [
        Buffer.from(state.lastPushCursor || '', 'base64'),
        Buffer.from(state.lastEmailCursor || '', 'base64')
    ].sort(Buffer.compare);
    let after = cursors[cursors.length - 1].toString('base64');

    let updates = await eventsFind(ctx, Store.UserDialogEventStore, [uid], { afterCursor: after });
    let messages = updates.items.filter(e => e.event instanceof UserDialogMessageReceivedEvent).map(e => e.event as UserDialogMessageReceivedEvent);

    let unreadCounter: number | undefined = undefined;

    // Handling unread messages
    let hasMessage = false;
    for (let m of messages) {
        let messageId = m.mid!;
        let message = await Store.Message.findById(ctx, messageId);
        if (!message) {
            continue;
        }

        let senderId = message.uid;
        let sender = await Modules.Users.profileById(ctx, senderId);
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

        hasMessage = true;
        let senderName = [sender.firstName, sender.lastName].filter((v) => !!v).join(' ');

        let pushTitle = Texts.Notifications.GROUP_PUSH_TITLE({senderName, chatTitle});

        if (conversation.kind === 'private') {
            pushTitle = chatTitle;
        }

        if (message.isService) {
            pushTitle = chatTitle;
        }

        let pushBody = await fetchMessageFallback(message);

        if (unreadCounter === undefined) {
            unreadCounter = await Modules.Messaging.fetchUserGlobalCounter(ctx, uid);
        }

        let push = {
            uid: uid,
            title: pushTitle,
            body: pushBody,
            picture: sender.picture ? buildBaseImageUrl(sender.picture!!) : null,
            counter: unreadCounter!,
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
        // workDone = true;
    }

    // Save state
    if (hasMessage) {
        state.lastPushNotification = Date.now();
    } else {
        await Modules.Push.sendCounterPush(ctx, uid);
    }

    log.debug(ctx, 'updated ' + state.lastPushSeq + '->' + ustate.seq);

    state.lastPushSeq = ustate.seq;
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