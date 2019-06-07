import { staticWorker } from 'openland-module-workers/staticWorker';
import { Modules } from 'openland-modules/Modules';
import { withLogContext } from 'openland-log/withLogContext';
import { inTx } from 'foundation-orm/inTx';
import { createLogger } from 'openland-log/createLogger';
import { FDB } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Texts } from '../texts';
import { MessageAttachmentFile } from '../MessageInput';
import { hasMention } from 'openland-module-messaging/resolvers/ModernMessage.resolver';

const Delays = {
    'none': 10 * 1000,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000
};

const log = createLogger('push');

export function startPushNotificationWorker() {
    staticWorker({ name: 'push_notifications', delay: 3000, startDelay: 3000 }, async (parent) => {
        let needNotificationDelivery = Modules.Messaging.needNotificationDelivery;
        let unreadUsers = await inTx(parent, async (ctx) => await needNotificationDelivery.findAllUsersWithNotifications(ctx, 'push'));
        log.debug(parent, 'unread users: ' + unreadUsers.length);
        // let workDone = false;
        for (let uid of unreadUsers) {
            await inTx(parent, async (ctx) => {
                ctx = withLogContext(ctx, ['user', '' + uid]);

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
                    return;
                }

                // Pause notifications till 1 minute passes from last active timeout
                if (lastSeen > (now - Delays[settings.notificationsDelay || 'none'])) {
                    log.debug(ctx, 'skip delay');
                    return;
                }

                // Ignore read updates
                if (state.readSeq === ustate.seq) {
                    log.debug(ctx, 'ignore read updates');
                    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
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
                    return;
                }

                // Ignore already processed updates
                if (state.lastPushSeq !== null && state.lastPushSeq >= ustate.seq) {
                    log.debug(ctx, 'ignore already processed updates');
                    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
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

                    let pushBody = '';

                    if (message.text) {
                        pushBody += message.text;
                    }
                    if (message.attachmentsModern) {
                        let fileAttachment = message.attachmentsModern.find(a => a.type === 'file_attachment');

                        if (fileAttachment) {
                            let attach = fileAttachment as MessageAttachmentFile;
                            let mime = attach.fileMetadata && attach.fileMetadata.mimeType;

                            if (!mime) {
                                pushBody += Texts.Notifications.DOCUMENT_ATTACH;
                            } else if (mime === 'image/gif') {
                                pushBody += Texts.Notifications.GIF_ATTACH;
                            } else if (attach.fileMetadata && attach.fileMetadata.isImage) {
                                pushBody += Texts.Notifications.IMAGE_ATTACH;
                            } else if (mime.startsWith('video/')) {
                                pushBody += Texts.Notifications.VIDEO_ATTACH;
                            }
                        }
                    }

                    if (pushBody.length === 0 && message.replyMessages) {
                        pushBody += Texts.Notifications.REPLY_ATTACH;
                    }

                    if (unreadCounter === undefined) {
                        unreadCounter = await FDB.UserCounter.byId(uid).get(ctx);
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
                    await Modules.Push.worker.pushWork(ctx, push);
                    // workDone = true;
                }

                // Save state
                if (hasMessage) {
                    state.lastPushNotification = Date.now();
                } else {
                    // Deliver counter if there are no updates
                    if (unreadCounter === undefined) {
                        unreadCounter = await FDB.UserCounter.byId(uid).get(ctx);
                    }
                    await Modules.Push.sendCounterPush(ctx, uid, 0, unreadCounter!);
                }

                log.debug(ctx, 'updated ' + state.lastPushSeq + '->' + ustate.seq);

                state.lastPushSeq = ustate.seq;
                needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'push', uid);
            });
        }
        // return workDone;
        return false;
    });
}