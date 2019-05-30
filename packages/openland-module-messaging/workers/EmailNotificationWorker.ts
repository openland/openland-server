import { staticWorker } from 'openland-module-workers/staticWorker';
import { Emails } from '../../openland-module-email/Emails';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { Message } from '../../openland-module-db/schema';
import { hasMention } from '../resolvers/ModernMessage.resolver';

const Delays = {
    '15min': 15 * 60 * 1000,
    '1hour': 60 * 60 * 1000,
    '24hour': 24 * 60 * 60 * 1000,
    '1week': 7 * 24 * 60 * 60 * 1000,
};

export function startEmailNotificationWorker() {
    staticWorker({ name: 'email_notifications', delay: 15000, startDelay: 3000 }, async (parent) => {
        let unreadUsers = await FDB.UserMessagingState.allFromHasUnread(parent);
        let now = Date.now();
        for (let u of unreadUsers) {
            await inTx(parent, async (ctx) => {
                let state = await Modules.Messaging.getUserNotificationState(ctx, u.uid);
                let lastSeen = await Modules.Presence.getLastSeen(ctx, u.uid);
                let isActive = await Modules.Presence.isActive(ctx, u.uid);
                let tag = 'email_notifications ' + u.uid;

                // Ignore active users
                if (isActive) {
                    return;
                }

                // Ignore never online
                if (lastSeen === 'never_online') {
                    return;
                }

                // Ignore recently online users
                if (lastSeen === 'online' || (lastSeen > now - 5 * 60 * 1000)) {
                    return;
                }

                // Ignore never opened apps
                if (state.readSeq === null) {
                    return;
                }

                // Ignore read updates
                if (state.readSeq === u.seq) {
                    return;
                }

                // Ignore already processed updates
                if (state.lastEmailSeq === u.seq) {
                    return;
                }

                let settings = await Modules.Users.getUserSettings(ctx, u.uid);

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
                let remainingUpdates = await FDB.UserDialogEvent.allFromUserAfter(ctx, u.uid, Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq));
                let messages = remainingUpdates.filter((v) => v.kind === 'message_received');

                let hasNonMuted = false;
                let msgs: Message[] = [];

                for (let m of messages) {
                    let message = await FDB.Message.findById(ctx, m.mid!);
                    if (!message) {
                        continue;
                    }

                    if (message.uid === u.uid) {
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

                    let userMentioned = hasMention(message, u.uid);

                    let conversationSettings = await Modules.Messaging.getRoomSettings(ctx, u.uid, conversation.id);
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
                    await Emails.sendUnreadMessages(ctx, u.uid, msgs);
                    state.lastEmailNotification = Date.now();
                }

                // Save state
                state.lastEmailSeq = u.seq;
            });
        }
        return false;
    });
}