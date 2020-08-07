import { injectable } from 'inversify';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Context } from '@openland/context';
import { FeedEvent, RichMessage } from '../../openland-module-db/store';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';

@injectable()
export class FeedMentionNotificationsMediator {
    private readonly queue = new BetterWorkerQueue<{ tid: number, messageId: number }>(Store.FeedMentionNotificationQueue, { type: 'transactional', maxAttempts: 'infinite' });

    start = async () => {
        if (serverRoleEnabled('workers')) {
            this.queue.addWorkers(100, async (root, item) => {
                return await inTx(root, async ctx => {
                    let message = await Store.RichMessage.findById(ctx, item.messageId);
                    if (!message || !message.spans) {
                        return;
                    }

                    let topic = await Store.FeedTopic.findById(ctx, item.tid);
                    if (!topic || !topic.key.startsWith('channel-')) {
                        return;
                    }

                    let cid = parseInt(topic.key.slice(8), 0);
                    let channel = await Store.FeedChannel.findById(ctx, cid);
                    if (!channel) {
                        return;
                    }

                    for (let span of message.spans) {
                        if (span.type === 'user_mention') {
                            if (span.user === message.uid) {
                                continue;
                            }

                            await Modules.NotificationCenter.sendNotification(ctx, span.user, {
                                text: `${await Modules.Users.getUserFullName(ctx, message.uid)} mentioned you in ${channel.title}`,
                                content: [{
                                    type: 'mention',
                                    peerId: span.user,
                                    peerType: 'user',
                                    messageId: item.tid,
                                    messageType: 'feed'
                                }],
                            });
                        }
                        if (span.type === 'room_mention') {
                            let rid = span.room;

                            let orgMemberIds = await Modules.Messaging.room.findConversationMembers(ctx, rid);
                            let orgMemberProfiles = await Promise.all(orgMemberIds.map(a => Modules.Messaging.room.findMembershipStatus(ctx, a, rid)));
                            let admins = orgMemberProfiles.filter(a => a && (a.role === 'admin' || a.role === 'owner'));
                            for (let admin of admins) {
                                if (message.uid === admin!.uid) {
                                    continue;
                                }
                                await Modules.NotificationCenter.sendNotification(ctx, admin!.uid, {
                                    text: `${await Modules.Users.getUserFullName(ctx, message.uid)} mentioned your chat in ${channel.title}`,
                                    content: [{
                                        type: 'mention',
                                        peerId: span.room,
                                        peerType: 'room',
                                        messageId: item.tid,
                                        messageType: 'feed'
                                    }],
                                });
                            }
                        }
                        if (span.type === 'organization_mention') {
                            let orgMembers = await Modules.Orgs.findOrganizationMembership(ctx, span.organization);
                            let admins = orgMembers.filter(a => a.role === 'admin');
                            for (let admin of admins) {
                                if (message.uid === admin.uid) {
                                    continue;
                                }
                                await Modules.NotificationCenter.sendNotification(ctx, admin.uid, {
                                    text: `${await Modules.Users.getUserFullName(ctx, message.uid)} mentioned your organization in ${channel.title}`,
                                    content: [{
                                        type: 'mention',
                                        peerId: span.organization,
                                        peerType: 'organization',
                                        messageId: item.tid,
                                        messageType: 'feed'
                                    }],
                                });
                            }
                        }
                    }
                    return;
                });
            });
        }
    }

    onNewItem = (ctx: Context, event: FeedEvent, message: RichMessage) => {
        if (this.haveMentions(message)) {
            this.queue.pushWork(ctx, { messageId: message.id, tid: event.tid });
        }
    }

    onItemUpdated = (ctx: Context, event: FeedEvent, message: RichMessage) => {
        if (this.haveMentions(message)) {
            this.queue.pushWork(ctx, { messageId: message.id, tid: event.tid });
        }
    }

    haveMentions = (message: RichMessage) => {
        return message.spans && message.spans.find(a => a.type === 'user_mention' || a.type === 'multi_user_mention' || a.type === 'organization_mention' || a.type === 'room_mention');
    }
}