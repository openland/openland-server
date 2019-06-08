import { staticWorker } from 'openland-module-workers/staticWorker';
import { Emails } from '../../openland-module-email/Emails';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { Message } from '../../openland-module-db/schema';
import { hasMention } from '../resolvers/ModernMessage.resolver';
import { createLogger } from 'openland-log/createLogger';

const Delays = {
    '15min': 15 * 60 * 1000,
    '1hour': 60 * 60 * 1000,
    '24hour': 24 * 60 * 60 * 1000,
    '1week': 7 * 24 * 60 * 60 * 1000,
};

const log = createLogger('email');

export function startEmailNotificationWorker() {
    staticWorker({ name: 'email_notifications', delay: 15000, startDelay: 3000 }, async (parent) => {
        let needNotificationDelivery = Modules.Messaging.needNotificationDelivery;
        let unreadUsers = await inTx(parent, async (ctx) => await needNotificationDelivery.findAllUsersWithNotifications(ctx, 'email'));
        log.debug(parent, 'unread users: ' + unreadUsers.length);
        let now = Date.now();
        for (let uid of unreadUsers) {
            await inTx(parent, async (ctx) => {
                let ustate = await Modules.Messaging.getUserMessagingState(ctx, uid);
                let state = await Modules.Messaging.getUserNotificationState(ctx, uid);
                let lastSeen = await Modules.Presence.getLastSeen(ctx, uid);
                let isActive = await Modules.Presence.isActive(ctx, uid);
                let tag = 'email_notifications ' + uid;

                // Ignore active users
                if (isActive) {
                    return;
                }

                // Ignore never online
                if (lastSeen === 'never_online') {
                    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
                    return;
                }

                // Ignore recently online users
                if (lastSeen === 'online' || (lastSeen > now - 5 * 60 * 1000)) {
                    return;
                }

                // Ignore never opened apps
                if (state.readSeq === null) {
                    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
                    return;
                }

                // Ignore read updates
                if (state.readSeq === ustate.seq) {
                    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
                    return;
                }

                // Ignore already processed updates
                if (state.lastEmailSeq === ustate.seq) {
                    return;
                }

                let settings = await Modules.Users.getUserSettings(ctx, uid);

                if (settings.emailFrequency === 'never') {
                    return;
                }

                // Read email timeouts
                let delta = Delays[settings.emailFrequency];

                // Do not send emails more than one in an hour
                if (state.lastEmailNotification !== null && state.lastEmailNotification > now - delta) {
                    return;
                }

                // Fetch pending updates
                let remainingUpdates = await FDB.UserDialogEvent.allFromUserAfter(ctx, uid, Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq));
                let messages = remainingUpdates.filter((v) => v.kind === 'message_received');

                let hasNonMuted = false;
                let msgs: Message[] = [];

                for (let m of messages) {
                    let message = await FDB.Message.findById(ctx, m.mid!);
                    if (!message) {
                        continue;
                    }

                    if (message.uid === uid) {
                        continue;
                    }

                    // disable email notificaitons for channels
                    let conversation = (await FDB.Conversation.findById(ctx, message.cid))!;
                    if (conversation.kind === 'room') {
                        if ((await FDB.ConversationRoom.findById(ctx, message.cid))!.kind === 'public') {
                            continue;
                        }
                    }

                    // Ignore service messages for big rooms
                    if (message.isService) {
                        if (await Modules.Messaging.roomMembersCount(ctx, message.cid) >= 50) {
                            continue;
                        }
                    }

                    let userMentioned = hasMention(message, uid);

                    let conversationSettings = await Modules.Messaging.getRoomSettings(ctx, uid, conversation.id);
                    if (conversationSettings.mute && !userMentioned) {
                        continue;
                    }

                    if (!message.isMuted) {
                        hasNonMuted = true;
                    }

                    msgs.push(message);
                }

                // Send email notification if there are some
                if (hasNonMuted) {
                    console.log(tag, 'new_email_notification');
                    await Emails.sendUnreadMessages(ctx, uid, msgs);
                    state.lastEmailNotification = Date.now();
                }

                // Save state
                state.lastEmailSeq = ustate.seq;
                needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
            });
        }
        return false;
    });
}