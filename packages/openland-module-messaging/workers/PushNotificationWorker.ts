import { staticWorker } from 'openland-module-workers/staticWorker';
import { Modules } from 'openland-modules/Modules';
import { withLogContext } from 'openland-log/withLogContext';
import { inTx } from 'foundation-orm/inTx';
import { createLogger } from 'openland-log/createLogger';
import { FDB } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Texts } from '../texts';

const Delays = {
    'none': 10 * 1000,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000
};

const log = createLogger('push');

export function startPushNotificationWorker() {
    staticWorker({ name: 'push_notifications', delay: 3000, startDelay: 3000 }, async (parent) => {
        let unreadUsers = await FDB.UserMessagingState.allFromHasUnread(parent);
        log.debug(parent, 'unread users: ' + unreadUsers.length);
        for (let u of unreadUsers) {
            await inTx(parent, async (ctx) => {
                ctx = withLogContext(ctx, ['user', '' + u.uid]);

                // Loading user's settings and state
                let settings = await Modules.Users.getUserSettings(ctx, u.uid);
                let state = await Modules.Messaging.getUserNotificationState(ctx, u.uid);

                let now = Date.now();

                let lastSeen = await Modules.Presence.getLastSeen(ctx, u.uid);
                let isActive = await Modules.Presence.isActive(ctx, u.uid);

                // Ignore never-online users
                if (lastSeen === 'never_online') {
                    log.debug(ctx, 'skip never-online');
                    state.lastPushSeq = u.seq;
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
                    return;
                }

                // Pause notifications till 1 minute passes from last active timeout
                if (lastSeen > (now - Delays[settings.notificationsDelay || 'none'])) {
                    log.debug(ctx, 'skip delay');
                    return;
                }

                // Ignore read updates
                if (state.readSeq === u.seq) {
                    log.debug(ctx, 'ignore read updates');
                    return;
                }

                // Ignore never opened apps
                if (state.readSeq === null) {
                    log.debug(ctx, 'ignore never opened apps');
                    return;
                }

                // Ignore user's with disabled notifications
                if (settings.mobileNotifications === 'none' && settings.desktopNotifications === 'none') {
                    state.lastPushSeq = u.seq;
                    log.debug(ctx, 'ignore user\'s with disabled notifications');
                    return;
                }

                // Ignore already processed updates
                if (state.lastPushSeq !== null && state.lastPushSeq >= u.seq) {
                    log.debug(ctx, 'ignore already processed updates');
                    return;
                }

                // Scanning updates
                let afterSec = Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq, state.lastPushSeq || 0);

                let remainingUpdates = await FDB.UserDialogEvent.allFromUserAfter(ctx, u.uid, afterSec);
                let messages = remainingUpdates.filter((v) => v.kind === 'message_received');

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

                    let unreadCount = m.allUnread!;
                    // Ignore current user
                    if (senderId === u.uid) {
                        continue;
                    }
                    let sender = await Modules.Users.profileById(ctx, senderId);
                    if (!sender) {
                        continue;
                    }
                    let receiver = await Modules.Users.profileById(ctx, u.uid);
                    if (!receiver) {
                        continue;
                    }
                    let conversation = await FDB.Conversation.findById(ctx, message.cid);
                    if (!conversation) {
                        continue;
                    }

                    let userMentioned = message.mentions && (message.mentions as number[]).indexOf(u.uid) > -1;

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

                    let conversationSettings = await Modules.Messaging.getRoomSettings(ctx, u.uid, conversation.id);
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

                    let chatTitle = await Modules.Messaging.room.resolveConversationTitle(ctx, conversation.id, u.uid);

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

                    let pushBody = '';

                    if (message.text) {
                        pushBody += message.text;
                    }
                    if (message.fileMetadata) {
                        pushBody += message.fileMetadata.isImage ? Texts.Notifications.IMAGE_ATTACH : Texts.Notifications.FILE_ATTACH;
                    }

                    let push = {
                        uid: u.uid,
                        title: pushTitle,
                        body: pushBody,
                        picture: sender.picture ? buildBaseImageUrl(sender.picture!!) : null,
                        counter: unreadCount,
                        conversationId: conversation.id,
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

                log.debug(ctx, 'updated ' + state.lastPushSeq + '->' + u.seq);

                state.lastPushSeq = u.seq;
            });
        }
        return false;
    });
}