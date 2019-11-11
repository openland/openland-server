import { injectable } from 'inversify';
import { WorkQueue } from '../../openland-module-workers/WorkQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Context } from '@openland/context';
import { Message } from '../../openland-module-db/store';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';

@injectable()
export class MentionNotificationsMediator {
    private readonly queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_mention_notifications_task');

    start = () => {
        if (serverRoleEnabled('workers')) {
            this.queue.addWorker(async (item, root) => {
                return await inTx(root, async ctx => {

                    let message = await Store.Message.findById(ctx, item.messageId);
                    if (!message || !message.spans) {
                        return { result: 'ok' };
                    }
                    if (!await Modules.Messaging.room.isPublicRoom(ctx, message.cid)) {
                        return { result: 'ok' };
                    }

                    for (let span of message.spans) {
                        if (span.type === 'user_mention') {
                            if (await Modules.Messaging.room.isRoomMember(ctx, span.user, message.cid)) {
                                continue;
                            }

                            await Modules.NotificationCenter.sendNotification(ctx, span.user, {
                               content: [{
                                   type: 'mention',
                                   peerId: span.user,
                                   peerType: 'user'
                               }]
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
                                    content: [{
                                        type: 'mention',
                                        peerId: span.room,
                                        peerType: 'room'
                                    }]
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
                                    content: [{
                                        type: 'mention',
                                        peerId: span.organization,
                                        peerType: 'organization'
                                    }]
                                });
                            }
                        }
                    }
                    return { result: 'ok' };
                });
            });
        }
    }

    onNewMessage = async (ctx: Context, message: Message) => {
        if (this.haveMentions(message)) {
            await this.queue.pushWork(ctx, { messageId: message.id });
        }
    }

    onMessageUpdated = async (ctx: Context, message: Message) => {
        if (this.haveMentions(message)) {
            await this.queue.pushWork(ctx, { messageId: message.id });
        }
    }

    haveMentions = (message: Message) => {
        return message.spans && message.spans.find(a =>
            a.type === 'user_mention' ||
            a.type === 'multi_user_mention' ||
            a.type === 'organization_mention' ||
            a.type === 'room_mention');
    }
}