import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Texts } from '../texts';
import { fetchMessageFallback } from 'openland-module-messaging/resolvers/ModernMessage.resolver';
import { createLogger, withLogPath } from '@openland/log';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { delay } from '@openland/foundationdb/lib/utils';
import { Context, createNamedContext } from '@openland/context';
import { eventsFind } from '../../openland-module-db/eventsFind';
import { UserDialogMessageReceivedEvent, UserSettings } from '../../openland-module-db/store';
import { batch } from '../../openland-utils/batch';

const Delays = {
    'none': 10 * 1000,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000,
};

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

const handleMessage = async (ctx: Context, uid: number, unreadCounter: number, settings: UserSettings, m: UserDialogMessageReceivedEvent) => {
    log.log(ctx, 'handle message', m.mid);

    let messageId = m.mid!;
    let message = await Store.Message.findById(ctx, messageId);
    if (!message) {
        log.debug(ctx, 'Message not found');
        return false;
    }

    // Ignore current user
    if (message.uid === uid) {
        log.debug(ctx, 'Ignore current user');
        return false;
    }

    let readMessageId = await Store.UserDialogReadMessageId.get(ctx, uid, message.cid);
    log.debug(ctx, 'readMessageId', readMessageId);
    // Ignore read messages
    if (readMessageId >= message.id) {
        log.debug(ctx, 'Ignore read messages');
        return false;
    }

    let sender = await Modules.Users.profileById(ctx, message.uid);
    let receiver = await Modules.Users.profileById(ctx, uid);
    let conversation = await Store.Conversation.findById(ctx, message.cid);

    if (!sender || !receiver || !conversation) {
        log.debug(ctx, 'no sender or receiver or conversation');
        return false;
    }

    let messageSettings = await Modules.Messaging.getSettingsForMessage(ctx, uid, m.mid);
    let sendMobile = messageSettings.mobile.showNotification;
    let sendDesktop = messageSettings.desktop.showNotification;

    if (!sendMobile && !sendDesktop) {
        log.debug(ctx, 'Ignore disabled pushes');
        return false;
    }

    let chatTitle = await Modules.Messaging.room.resolveConversationTitle(ctx, conversation.id, uid);

    if (chatTitle.startsWith('@')) {
        chatTitle = chatTitle.slice(1);
    }

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
    return true;
};

const handleUser = async (root: Context, uid: number) => {
    try {
        return await inTx(root, async _ctx => {
            let ctx = withLogPath(_ctx, 'user ' + uid);

            log.debug(ctx, 'handle');

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

            // Scanning updates
            // let cursors = [
            //     Buffer.from(state.lastPushCursor || '', 'base64'),
            //     Buffer.from(state.lastEmailCursor || '', 'base64')
            // ].sort(Buffer.compare);
            // let after = cursors[cursors.length - 1].toString('base64');
            let after = state.lastPushCursor || '';

            let updates = await eventsFind(ctx, Store.UserDialogEventStore, [uid], { afterCursor: after });
            let messages = updates.items.filter(e => e.event instanceof UserDialogMessageReceivedEvent).map(e => e.event as UserDialogMessageReceivedEvent);
            log.log(ctx, messages.length, 'messages found');

            let unreadCounter: number = await Modules.Messaging.fetchUserGlobalCounter(ctx, uid);

            // Handling unread messages
            let hasPush = false;
            await Promise.all(messages.map(async m => {
                let res = await handleMessage(ctx, uid, unreadCounter, settings, m);
                if (res) {
                    hasPush = true;
                }
            }));

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
    } catch (e) {
        log.log(rootCtx, 'push_error', e);
    }
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

        for (let b of batches) {
            await inTx(rootCtx, async ctx => {
                await Promise.all(b.map(uid => handleUser(ctx, uid)));
            });
        }
    });
}