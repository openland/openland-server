import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { trackServerEvent } from '../openland-module-hyperlog/Log.resolver';
import { Comment, ConversationRoom, Message, Notification, Organization } from '../openland-module-db/schema';
import { FDB } from '../openland-module-db/FDB';

@injectable()
export class MetricsModule {
    start = () => {
        // Nothing to do
    }

    async onMessageReceived(ctx: Context, message: Message, uid: number) {
        if (message.uid !== uid) {
            await trackServerEvent(ctx, { name: 'message_received', uid });

            // Send metrics
            let mentions = (message.spans || []).filter(span => span.type === 'user_mention' || span.type === 'multi_user_mention' || span.type === 'all_mention');
            for (let mention of mentions) {
                if (mention.type === 'user_mention') {
                    await trackServerEvent(ctx, { name: 'mention_received', uid, args: { mention_type: 'full_name' } });
                } else if (mention.type === 'multi_user_mention') {
                    await trackServerEvent(ctx, { name: 'mention_received', uid, args: { mention_type: 'full_name' } });
                } else if (mention.type === 'all_mention') {
                    await trackServerEvent(ctx, { name: 'mention_received', uid, args: { mention_type: 'all_mention' } });
                }
            }
        }
    }

    async onInternalNotificationReceived(ctx: Context, notification: Notification, uid: number) {
        if (notification.content && notification.content.find(c => c.type === 'new_comment')) {
            await trackServerEvent(ctx, {name: 'comment_notification_received', uid});
        }
    }

    async onCommentCreated(ctx: Context, message: Message, comment: Comment) {
        await trackServerEvent(ctx, {name: 'comment_to_message_received', uid: message.uid});
        if (comment.parentCommentId) {
            let parentComment = await FDB.Comment.findById(ctx, comment.parentCommentId);
            if (parentComment) {
                await trackServerEvent(ctx, {name: 'reply_to_comment_received', uid: parentComment.uid});
            }
        }
    }

    async onChatInviteJoin(ctx: Context, uid: number, inviterId: number, chat: ConversationRoom) {
        let user = (await FDB.User.findById(ctx, uid))!;
        if (user.status === 'activated') {
            return;
        }
        await trackServerEvent(ctx, { name: 'invited_contact_joined', uid: inviterId, args: { invite_type: chat!.isChannel ? 'channel' : 'group' } });
    }

    async onOpenlandInviteJoin(ctx: Context, uid: number, inviterId: number) {
        let user = (await FDB.User.findById(ctx, uid))!;
        if (user.status === 'activated') {
            return;
        }
        await trackServerEvent(ctx, { name: 'invited_contact_joined', uid: inviterId, args: { invite_type: 'Openland' } });
    }

    async onOrganizationInviteJoin(ctx: Context, uid: number, inviterId: number, org: Organization) {
        let user = (await FDB.User.findById(ctx, uid))!;
        if (user.status === 'activated') {
            return;
        }
        await trackServerEvent(ctx, { name: 'invited_contact_joined', uid: inviterId, args: { invite_type: org.kind } });
    }

    async onUserActivated(ctx: Context, uid: number) {
        await trackServerEvent(ctx, { name: 'account_activated', uid });
    }

    async onReactionAdded(ctx: Context, message: Message, reaction: string) {
        await trackServerEvent(ctx, { name: 'reaction_received', uid: message.uid, args: { reaction_type: reaction } });
    }
}