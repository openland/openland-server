import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { FDB, Store } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Texts } from '../texts';
import { fetchMessageFallback, hasMention } from 'openland-module-messaging/resolvers/ModernMessage.resolver';
import { createLogger, withLogPath } from '@openland/log';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { delay } from '@openland/foundationdb/lib/utils';

const Delays = {
    'none': 10 * 1000,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000
};

const log = createLogger('push');

export function startPushNotificationWorker() {
    singletonWorker({ name: 'push_notifications', delay: 3000, startDelay: 3000, db: FDB.layer.db }, async (parent) => {
        let needNotificationDelivery = Modules.Messaging.needNotificationDelivery;
        let unreadUsers = await inTx(parent, async (ctx) => await needNotificationDelivery.findAllUsersWithNotifications(ctx, 'push'));
        if (unreadUsers.length > 0) {
            log.debug(parent, 'unread users: ' + unreadUsers.length);
        } else {
            await delay(5000);
            return;
        }
        // let workDone = false;
        for (let uid of unreadUsers) {
            await inTx(parent, async (ctx) => {
                ctx = withLogPath(ctx, 'user ' + uid);

                // Loading user's settings and state
                let ustate = await Modules.Messaging.getUserMessagingState(ctx, uid);
                let settings = await Modules.Users.getUserSettings(ctx, uid);
                let state = await Modules.Messaging.getUserNotificationState(ctx, uid);

                let now = Date.now();

                let lastSeen = await Modules.Presence.getLastSeen(ctx, uid);
                let isActive = await Modules.Presence.isActive(ctx, uid);

                // Ignore never-online users
                if (lastSeen === 'never_online') {
                    log.debug(ctx, 'skip never-online');
                    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    return;
                }

                // // Pause notifications only if delay was set
                // // if (settings.notificationsDelay !== 'none') {
                // // Ignore online
                // if (lastSeen === 'online') {
                //     log.debug(ctx, 'skip online');
                //     return;
                // }

                // Ignore active users
                if (isActive) {
                    log.debug(ctx, 'skip active');
                    await Modules.Push.sendCounterPush(ctx, uid);
                    return;
                }

                // Pause notifications till 1 minute passes from last active timeout
                if (lastSeen > (now - Delays[settings.notificationsDelay || 'none'])) {
                    log.debug(ctx, 'skip delay');
                    await Modules.Push.sendCounterPush(ctx, uid);
                    return;
                }

                // Ignore read updates
                if (state.readSeq === ustate.seq) {
                    log.debug(ctx, 'ignore read updates');
                    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    await Modules.Push.sendCounterPush(ctx, uid);
                    return;
                }

                // Ignore never opened apps
                if (state.readSeq === null) {
                    log.debug(ctx, 'ignore never opened apps');
                    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    return;
                }

                // Ignore user's with disabled notifications
                if (settings.mobileNotifications === 'none' && settings.desktopNotifications === 'none') {
                    state.lastPushSeq = ustate.seq;
                    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    log.debug(ctx, 'ignore user\'s with disabled notifications');
                    await Modules.Push.sendCounterPush(ctx, uid);
                    return;
                }

                // Ignore already processed updates
                if (state.lastPushSeq !== null && state.lastPushSeq >= ustate.seq) {
                    log.debug(ctx, 'ignore already processed updates');
                    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
                    await Modules.Push.sendCounterPush(ctx, uid);
                    return;
                }

                // Scanning updates
                let afterSec = Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq, state.lastPushSeq || 0);

                let remainingUpdates = await FDB.UserDialogEvent.allFromUserAfter(ctx, uid, afterSec);
                let messages = remainingUpdates.filter((v) => v.kind === 'message_received');

                let unreadCounter: number | undefined = undefined;

                // Handling unread messages
                let hasMessage = false;
                for (let m of messages) {
                    if (m.seq <= afterSec) {
                        continue;
                    }

                    let messageId = m.mid!;
                    let message = await FDB.Message.findById(ctx, messageId);
                    if (!message) {
                        continue;
                    }
                    let senderId = message.uid!;

                    // Ignore current user
                    if (senderId === uid) {
                        continue;
                    }
                    let sender = await Modules.Users.profileById(ctx, senderId);
                    if (!sender) {
                        continue;
                    }
                    let receiver = await Modules.Users.profileById(ctx, uid);
                    if (!receiver) {
                        continue;
                    }
                    let conversation = await FDB.Conversation.findById(ctx, message.cid);
                    if (!conversation) {
                        continue;
                    }

                    // Ignore service messages for big rooms
                    if (message.isService) {
                        if (await Modules.Messaging.roomMembersCount(ctx, message.cid) >= 50) {
                            continue;
                        }
                    }

                    let userMentioned = hasMention(message, uid);

                    let sendDesktop = settings.desktopNotifications !== 'none';
                    let sendMobile = settings.mobileNotifications !== 'none';

                    // Filter non-private if only direct messages enabled
                    if (settings.desktopNotifications === 'direct') {
                        if (conversation.kind !== 'private') {
                            sendDesktop = false;
                        }
                    }
                    if (settings.mobileNotifications === 'direct') {
                        if (conversation.kind !== 'private') {
                            sendMobile = false;
                        }
                    }

                    let conversationSettings = await Modules.Messaging.getRoomSettings(ctx, uid, conversation.id);
                    if (conversationSettings.mute && !userMentioned) {
                        continue;
                    }

                    if (userMentioned) {
                        sendMobile = true;
                        sendDesktop = true;
                    }

                    if (!sendMobile && !sendDesktop) {
                        continue;
                    }

                    let chatTitle = await Modules.Messaging.room.resolveConversationTitle(ctx, conversation.id, uid);

                    if (chatTitle.startsWith('@')) {
                        chatTitle = chatTitle.slice(1);
                    }

                    hasMessage = true;
                    let senderName = [sender.firstName, sender.lastName].filter((v) => !!v).join(' ');

                    let pushTitle = Texts.Notifications.GROUP_PUSH_TITLE({ senderName, chatTitle });

                    if (conversation.kind === 'private') {
                        pushTitle = chatTitle;
                    }

                    if (message.isService) {
                        pushTitle = chatTitle;
                    }

                    let pushBody = await fetchMessageFallback(message);

                    if (unreadCounter === undefined) {
                        unreadCounter = await Store.UserCounter.byId(uid).get(ctx);
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
                        mobileAlert: (settings.mobileAlert !== undefined && settings.mobileAlert !== null) ? settings.mobileAlert : true,
                        mobileIncludeText: (settings.mobileIncludeText !== undefined && settings.mobileIncludeText !== null) ? settings.mobileIncludeText : true,
                        silent: null
                    };

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
                needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
            });
        }
    });
}