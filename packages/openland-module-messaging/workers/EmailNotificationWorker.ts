import { staticWorker } from 'openland-module-workers/staticWorker';
import { Emails } from '../../openland-module-email/Emails';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

export function startEmailNotificationWorker() {
    staticWorker({ name: 'email_notifications', delay: 15000, startDelay: 3000 }, async () => {

        let unreadUsers = await FDB.UserMessagingState.allFromHasUnread();
        let now = Date.now();
        for (let u of unreadUsers) {
            await inTx(async () => {
                let state = await Modules.Messaging.getUserNotificationState(u.uid);
                let lastSeen = await Modules.Presence.getLastSeen(u.uid);
                let tag = 'email_notifications ' + u.uid;

                // Ignore online or never-online users
                if (lastSeen === null) {
                    return;
                }

                // Ignore recently online users
                if (lastSeen > now - 5 * 60 * 1000) {
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

                let settings = await Modules.Users.getUserSettings(u.uid);
                if (settings.emailFrequency !== 'never') {

                    // Read email timeouts
                    let delta = 0;

                    if (settings.emailFrequency === '1hour') {
                        delta = 60 * 60 * 1000;
                    } else if (settings.emailFrequency === '15min') {
                        delta = 15 * 60 * 1000;
                    } else if (settings.emailFrequency === '24hour') {
                        delta = 24 * 60 * 60 * 1000;
                    } else if (settings.emailFrequency === '1week') {
                        delta = 7 * 24 * 60 * 60 * 1000;
                    }

                    // Do not send emails more than one in an hour
                    if (state.lastEmailNotification !== null && state.lastEmailNotification > now - delta) {
                        return;
                    }

                    // Fetch pending updates
                    let remainingUpdates = await FDB.UserDialogEvent.allFromUserAfter(u.uid, Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq));
                    let messages = remainingUpdates
                        .filter((v) => v.kind === 'message_received')
                        .filter((v) => v.uid !== u.uid);

                    let hasNonMuted = false;
                    for (let m of messages) {
                        let message = await FDB.Message.findById(m.mid!);
                        if (!message) {
                            continue;
                        }

                        // disable email notificaitons for channels
                        let conversation = (await FDB.Conversation.findById(message.cid))!;
                        if (conversation.kind === 'room') {
                            if ((await FDB.ConversationRoom.findById(message.cid))!.kind === 'public') {
                                continue;
                            }
                        }

                        let conversationSettings = await Modules.Messaging.getConversationSettings(u.uid, conversation.id);

                        if (conversationSettings.mute) {
                            continue;
                        }

                        if (!message.isMuted) {
                            hasNonMuted = true;
                        }
                    }

                    // Send email notification if there are some
                    if (hasNonMuted) {
                        console.log(tag, 'new_email_notification');
                        await Emails.sendUnreadMesages(u.uid, u.unread);
                        state.lastEmailNotification = Date.now();
                    }
                }

                // Save state
                state.lastEmailSeq = u.seq;
            });
        }
        return false;
    });
}