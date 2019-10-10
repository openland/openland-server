import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { trackServerEvent } from '../openland-module-hyperlog/Log.resolver';
import { Comment, Message } from '../openland-module-db/store';
import { Store } from '../openland-module-db/FDB';
import { REACTIONS_LEGACY } from '../openland-module-messaging/resolvers/ModernMessage.resolver';
import { Organization, Notification, ConversationRoom } from 'openland-module-db/store';

@injectable()
export class MetricsModule {
    start = () => {
        // Nothing to do
    }

    onMessageReceived(ctx: Context, message: Message, uid: number) {
        if (message.uid !== uid) {
            trackServerEvent(ctx, { name: 'message_received', uid });

            // Send metrics
            let mentions = (message.spans || []).filter(span => span.type === 'user_mention' || span.type === 'multi_user_mention' || span.type === 'all_mention');
            for (let mention of mentions) {
                if (mention.type === 'user_mention') {
                    if (mention.user === uid) {
                        trackServerEvent(ctx, { name: 'mention_received', uid, args: { mention_type: 'full_name' } });
                    }
                } else if (mention.type === 'multi_user_mention') {
                    if (mention.users.indexOf(uid) > -1) {
                        trackServerEvent(ctx, { name: 'mention_received', uid, args: { mention_type: 'full_name' } });
                    }
                } else if (mention.type === 'all_mention') {
                    trackServerEvent(ctx, { name: 'mention_received', uid, args: { mention_type: 'all_mention' } });
                }
            }
        }
    }

    async onInternalNotificationReceived(ctx: Context, notification: Notification, uid: number) {
        if (notification.content && notification.content.find(c => c.type === 'new_comment')) {
            trackServerEvent(ctx, { name: 'comment_notification_received', uid });
        }
    }

    async onCommentCreated(ctx: Context, message: Message, comment: Comment) {
        trackServerEvent(ctx, { name: 'comment_to_message_received', uid: message.uid });
        if (comment.parentCommentId) {
            let parentComment = await Store.Comment.findById(ctx, comment.parentCommentId);
            if (parentComment) {
                trackServerEvent(ctx, { name: 'reply_to_comment_received', uid: parentComment.uid });
            }
        }
    }

    async onChatInviteJoin(ctx: Context, uid: number, inviterId: number, chat: ConversationRoom) {
        let user = (await Store.User.findById(ctx, uid))!;
        if (user.status === 'activated') {
            return;
        }
        trackServerEvent(ctx, { name: 'invited_contact_joined', uid: inviterId, args: { invite_type: chat!.isChannel ? 'channel' : 'group' } });
    }

    async onOpenlandInviteJoin(ctx: Context, uid: number, inviterId: number) {
        let user = (await Store.User.findById(ctx, uid))!;
        if (user.status === 'activated') {
            return;
        }
        trackServerEvent(ctx, { name: 'invited_contact_joined', uid: inviterId, args: { invite_type: 'Openland' } });
    }

    async onOrganizationInviteJoin(ctx: Context, uid: number, inviterId: number, org: Organization) {
        let user = (await Store.User.findById(ctx, uid))!;
        if (user.status === 'activated') {
            return;
        }
        trackServerEvent(ctx, { name: 'invited_contact_joined', uid: inviterId, args: { invite_type: org.kind } });
    }

    async onUserActivated(ctx: Context, uid: number) {
        trackServerEvent(ctx, { name: 'account_activated', uid });
    }

    async onReactionAdded(ctx: Context, message: Message, reaction: string) {
        trackServerEvent(ctx, { name: 'reaction_received', uid: message.uid, args: { reaction_type: REACTIONS_LEGACY.has(reaction) ? REACTIONS_LEGACY.get(reaction)!.toLowerCase() : reaction } });
    }

    onBillyBotMuted(ctx: Context, uid: number) {
        trackServerEvent(ctx, { name: 'billy_bot_muted', uid });
    }

    onBillyBotMessageRecieved(ctx: Context, uid: number, messageType: string) {
        trackServerEvent(ctx, { name: 'billy_bot_message_received', uid, args: {
                message_type: messageType
            }
        });
    }

    onChatJoined(ctx: Context, uid: number, wasInvited: boolean) {
        trackServerEvent(ctx, {
            uid: uid,
            name: 'chat_joined',
            args: {
                added_by_user: wasInvited
            }
        });
    }

    onChatLeave(ctx: Context, uid: number, wasKicked: boolean) {
        trackServerEvent(ctx, {
            uid: uid,
            name: 'chat_left',
            args: {
                kicked_by_user: wasKicked
            }
        });
    }
}