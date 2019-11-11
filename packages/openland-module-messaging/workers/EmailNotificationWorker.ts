import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Emails } from '../../openland-module-email/Emails';
import { Modules } from 'openland-modules/Modules';
import { Message, UserDialogMessageReceivedEvent } from '../../openland-module-db/store';
import { hasMention } from '../resolvers/ModernMessage.resolver';
import { createLogger } from '@openland/log';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { delay } from '@openland/foundationdb/lib/utils';
import { Context } from '@openland/context';
import { batch } from '../../openland-utils/batch';
import { eventsFind } from '../../openland-module-db/eventsFind';

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
    let state = await Modules.Messaging.getUserNotificationState(ctx, uid);
    let lastSeen = await Modules.Presence.getLastSeen(ctx, uid);
    let isActive = await Modules.Presence.isActive(ctx, uid);
    let tag = 'email_notifications ' + uid;

    // Ignore active users
    if (isActive) {
        log.debug(ctx, tag, 'Ignore active users');
        needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
        return;
    }

    // Ignore never online
    if (lastSeen === 'never_online') {
        log.debug(ctx, tag, 'Ignore never online');
        needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
        return;
    }

    // Ignore recently online users
    if (lastSeen === 'online' || (lastSeen > now - 5 * 60 * 1000)) {
        log.debug(ctx, tag, 'Ignore recently online users');
        needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
        return;
    }

    // Ignore already processed updates
    let eventsTail = await Store.UserDialogEventStore.createStream(uid, { batchSize: 1 }).tail(ctx);
    if (eventsTail && state.lastEmailCursor) {
        let comp = Buffer.compare(Buffer.from(state.lastEmailCursor, 'base64'), Buffer.from(eventsTail, 'base64'));
        if (comp === 0) {
            log.debug(ctx, tag, 'ignore already processed updates');
            needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
            return;
        }
    }

    let settings = await Modules.Users.getUserSettings(ctx, uid);

    if (settings.emailFrequency === 'never') {
        log.debug(ctx, tag, 'Ignore emailFrequency=never');
        needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
        return;
    }

    // Read email timeouts
    let delta = Delays[settings.emailFrequency];

    // Do not send emails more than one in an hour
    if (state.lastEmailNotification !== null && state.lastEmailNotification > now - delta) {
        log.debug(ctx, tag, 'Do not send emails more than one in an hour');
        needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
        return;
    }
    // Scanning updates
    // let cursors = [
    //     Buffer.from(state.lastPushCursor || '', 'base64'),
    //     Buffer.from(state.lastEmailCursor || '', 'base64')
    // ].sort(Buffer.compare);
    // let after = cursors[cursors.length - 1].toString('base64');
    let after = state.lastEmailCursor || '';
    let updates = await eventsFind(ctx, Store.UserDialogEventStore, [uid], { afterCursor: after });
    let messages = updates.items.filter(e => e.event instanceof UserDialogMessageReceivedEvent).map(e => e.event as UserDialogMessageReceivedEvent);

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

        // disable email notificaitons for channels and public chats
        let conversation = (await Store.Conversation.findById(ctx, message.cid))!;
        if (conversation.kind === 'room') {
            let room = (await Store.ConversationRoom.findById(ctx, message.cid))!;
            if (room.isChannel || room.kind === 'public') {
                log.debug(ctx, tag, 'disable email notificaitons for channels');
                continue;
            }
        }

        let readMessageId = await Store.UserDialogReadMessageId.get(ctx, uid, message.cid);
        // Ignore read messages
        if (readMessageId >= message.id) {
            log.debug(ctx, tag, 'Ignore read messages');
            continue;
        }

        // Ignore service messages for big rooms
        if (message.isService) {
            if (await Modules.Messaging.roomMembersCount(ctx, message.cid) >= 50) {
                log.debug(ctx, tag, 'Ignore service messages for big rooms');
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
    state.lastEmailCursor = await Store.UserDialogEventStore.createStream(uid, { batchSize: 1 }).tail(ctx);
    needNotificationDelivery.resetNeedNotificationDelivery(ctx, 'email', uid);
};

export function startEmailNotificationWorker() {
    singletonWorker({ name: 'email_notifications', delay: 60 * 1000, startDelay: 3000, db: Store.storage.db }, async (parent) => {
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