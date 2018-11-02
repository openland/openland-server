import { staticWorker } from 'openland-module-workers/staticWorker';
import { DB } from 'openland-server/tables';
import { Repos } from 'openland-server/repositories';
import { buildBaseImageUrl } from 'openland-server/repositories/Media';
import { Texts } from 'openland-server/texts';
import { Modules } from 'openland-modules/Modules';
import { withLogContext } from 'openland-log/withLogContext';
import { inTx } from 'foundation-orm/inTx';
import { createLogger } from 'openland-log/createLogger';
import { FDB } from 'openland-module-db/FDB';

const Delays = {
    'none': 10 * 1000,
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000
};

const log = createLogger('push');

export function startPushNotificationWorker() {
    staticWorker({ name: 'push_notifications', delay: 3000 }, async () => {
        let unreadUsers = await FDB.UserMessagingState.allFromHasUnread();
        log.debug('unread users: ' + unreadUsers.length);
        for (let u of unreadUsers) {
            await inTx(async () => {
                await withLogContext(['user', '' + u.uid], async () => {
                    // Loading user's settings and state
                    let settings = await Modules.Users.getUserSettings(u.uid);
                    let state = await Modules.Messaging.repo.getUserNotificationState(u.uid);

                    let now = Date.now();

                    let lastSeen = await Modules.Presence.getLastSeen(u.uid);

                    // Ignore never-online users
                    if (lastSeen === 'never_online') {
                        log.log('skip never-online');
                        state.lastPushSeq = u.seq;
                        return;
                    }

                    // Pause notifications only if delay was set
                    // if (settings.notificationsDelay !== 'none') {
                    // Ignore online
                    if (lastSeen === 'online') {
                        log.log('skip online');
                        return;
                    }

                    // Pause notifications till 1 minute passes from last active timeout
                    if (lastSeen > (now - Delays[settings.notificationsDelay || 'none'])) {
                        log.log('skip delay');
                        return;
                    }

                    // Ignore read updates
                    if (state.readSeq === u.seq) {
                        log.log('ignore read updates');
                        return;
                    }

                    // Ignore never opened apps
                    if (state.readSeq === null) {
                        log.log('ignore never opened apps');
                        return;
                    }

                    // Ignore user's with disabled notifications
                    if (settings.mobileNotifications === 'none' && settings.desktopNotifications === 'none') {
                        state.lastPushSeq = u.seq;
                        log.log('ignore user\'s with disabled notifications');
                        return;
                    }

                    // Ignore already processed updates
                    if (state.lastPushSeq !== null && state.lastPushSeq >= u.seq) {
                        log.log('ignore already processed updates');
                        return;
                    }

                    // Scanning updates
                    let afterSec = Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq, state.lastPushSeq || 0);

                    let remainingUpdates = await FDB.UserDialogEvent.allFromUserAfter(u.uid, afterSec);
                    let messages = remainingUpdates.filter((v) => v.kind === 'message_received');

                    // Handling unread messages
                    let hasMessage = false;
                    for (let m of messages) {
                        if (m.seq <= afterSec) {
                            continue;
                        }

                        let messageId = m.mid!;
                        let message = await FDB.Message.findById(messageId);
                        if (!message) {
                            continue;
                        }
                        let senderId = message.uid!;

                        let unreadCount = m.allUnread!;
                        // Ignore current user
                        if (senderId === u.uid) {
                            continue;
                        }
                        let sender = await Modules.Users.profileById(senderId);
                        if (!sender) {
                            continue;
                        }
                        let receiver = await Modules.Users.profileById(u.uid);
                        if (!receiver) {
                            continue;
                        }
                        let conversation = await DB.Conversation.findById(message.cid);
                        if (!conversation) {
                            continue;
                        }

                        let userMentioned = message.mentions && (message.mentions as number[]).indexOf(u.uid) > -1;

                        let sendDesktop = settings.desktopNotifications !== 'none';
                        let sendMobile = settings.mobileNotifications !== 'none';

                        // Filter non-private if only direct messages enabled
                        if (settings.desktopNotifications === 'direct') {
                            if (conversation.type !== 'private') {
                                sendDesktop = false;
                            }
                        }
                        if (settings.mobileNotifications === 'direct') {
                            if (conversation.type !== 'private') {
                                sendMobile = false;
                            }
                        }

                        let conversationSettings = await Modules.Messaging.getConversationSettings(u.uid, conversation.id);
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

                        let receiverPrimaryOrg =  await DB.Organization.findById(receiver.primaryOrganization || (await Repos.Users.fetchUserAccounts(receiver.id))[0]);
                        if (!receiverPrimaryOrg) {
                            continue;
                        }
                        let chatTitle = await Repos.Chats.getConversationTitle(conversation.id, receiverPrimaryOrg.id, u.uid);

                        hasMessage = true;
                        let senderName = [sender.firstName, sender.lastName].filter((v) => !!v).join(' ');

                        let pushTitle = Texts.Notifications.GROUP_PUSH_TITLE({ senderName, chatTitle });

                        if (conversation.type === 'private') {
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
                            mobileIncludeText: ( settings.mobileIncludeText !== undefined &&  settings.mobileIncludeText !== null) ?  settings.mobileIncludeText : true,
                            silent: null
                        };

                        log.debug('new_push', JSON.stringify(push));
                        await Modules.Push.worker.pushWork(push);
                    }

                    // Save state
                    if (hasMessage) {
                        state.lastPushNotification = Date.now();
                    }

                    log.debug('updated ' + state.lastPushSeq + '->' + u.seq);

                    state.lastPushSeq = u.seq;
                });
            });
        }
        return false;
    });
}