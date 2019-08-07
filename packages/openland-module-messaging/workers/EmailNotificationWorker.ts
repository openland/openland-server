import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Emails } from '../../openland-module-email/Emails';
import { Modules } from 'openland-modules/Modules';
import { Message } from '../../openland-module-db/store';
import { hasMention } from '../resolvers/ModernMessage.resolver';
import { createLogger } from '@openland/log';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { delay } from '@openland/foundationdb/lib/utils';
import { Context } from '@openland/context';
import { batch } from '../../openland-utils/batch';

const Delays = {
    '15min': 15 * 60 * 1000,
    '1hour': 60 * 60 * 1000,
    '24hour': 24 * 60 * 60 * 1000,
    '1week': 7 * 24 * 60 * 60 * 1000,
};

const log = createLogger('email');

const handleUser = async (ctx: Context, uid: number) => {
    const needNotificationDelivery = Modules.Messaging.needNotificationDelivery;
    let now = Date.now();
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
    let remainingUpdates = (await Store.UserDialogEvent.user.query(ctx, uid, { after: Math.max(state.lastEmailSeq ? state.lastEmailSeq : 0, state.readSeq) })).items;
    let messages = remainingUpdates.filter((v) => v.kind === 'message_received');

    let hasNonMuted = false;
    let msgs: Message[] = [];

    for (let m of messages) {
        let message = await Store.Message.findById(ctx, m.mid!);
        if (!message) {
            continue;
        }

        if (message.uid === uid) {
            continue;
        }

        // disable email notificaitons for channels
        let conversation = (await Store.Conversation.findById(ctx, message.cid))!;
        if (conversation.kind === 'room') {
            if ((await Store.ConversationRoom.findById(ctx, message.cid))!.kind === 'public') {
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
        log.log(ctx, tag, 'new_email_notification');
        await Emails.sendUnreadMessages(ctx, uid, msgs);
        state.lastEmailNotification = Date.now();
    }

    // Save state
    state.lastEmailSeq = ustate.seq;
    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
};

export function startEmailNotificationWorker() {
    singletonWorker({ name: 'email_notifications', delay: 15000, startDelay: 3000, db: Store.storage.db }, async (parent) => {
        let unreadUsers = await inTx(parent, async (ctx) => await Modules.Messaging.needNotificationDelivery.findAllUsersWithNotifications(ctx, 'email'));
        if (unreadUsers.length > 0) {
            log.debug(parent, 'unread users: ' + unreadUsers.length);
        } else {
            await delay(5000);
            return;
        }
        let batches = batch(unreadUsers, 10);
        await Promise.all(batches.map(b => inTx(parent, async (c) => {
            await Promise.all(b.map(uid => handleUser(c, uid)));
        })));
    });
}