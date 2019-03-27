import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { IDs } from 'openland-module-api/IDs';
import { MessageAttachmentInput } from '../MessageInput';
import { UserError } from '../../openland-errors/UserError';
import { FDB } from '../../openland-module-db/FDB';
import { NotFoundError } from '../../openland-errors/NotFoundError';

export default {
    Mutation: {
        roomRead: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let mid = IDs.ConversationMessage.parse(args.mid);
            await Modules.Messaging.readRoom(ctx, uid, cid, mid);
            return true;
        }),

        betaMessageSend: withUser(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.room);

            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));
            let mentions = args.mentions && args.mentions.map(id => IDs.User.parse(id));

            let attachments: MessageAttachmentInput[] = [];

            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(ctx, args.file);
                let filePreview: string | null = null;
                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(ctx, args.file);
                }
                attachments.push({
                    type: 'file_attachment',
                    fileId: args.file,
                    fileMetadata: fileInfo,
                    filePreview
                });
            }

            await Modules.Messaging.sendMessage(ctx, conversationId, uid!, {
                message: args.message,
                attachments,
                replyMessages,
                mentions,
                repeatKey: args.repeatKey
            });
            return true;
        }),
        betaMessageEdit: withUser(async (ctx, args, uid) => {
            let mid = IDs.ConversationMessage.parse(args.mid);
            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));
            let mentions = args.mentions && args.mentions.map(id => IDs.User.parse(id));

            let attachments: MessageAttachmentInput[] = [];

            if (args.file) {
                let fileInfo = await Modules.Media.saveFile(ctx, args.file);
                let filePreview: string | null = null;
                if (fileInfo.isImage) {
                    filePreview = await Modules.Media.fetchLowResPreview(ctx, args.file);
                }
                attachments.push({
                    type: 'file_attachment',
                    fileId: args.file,
                    fileMetadata: fileInfo,
                    filePreview
                });
            }

            await Modules.Messaging.editMessage(ctx, mid, uid, {
                message: args.message,
                attachments,
                replyMessages,
                mentions
            }, true);
            return true;
        }),
        betaMessageDelete: withUser(async (ctx, args, uid) => {
            if (args.mid) {
                let messageId = IDs.ConversationMessage.parse(args.mid);
                await Modules.Messaging.deleteMessage(ctx, messageId, uid);
                return true;
            } else if (args.mids) {
                let messageIds = args.mids.map(mid => IDs.ConversationMessage.parse(mid));
                await Modules.Messaging.deleteMessages(ctx, messageIds, uid);
                return true;
            }
            return false;

        }),
        betaMessageDeleteAugmentation: withUser(async (ctx, args, uid) => {
            let mid = IDs.ConversationMessage.parse(args.mid);

            let message = await FDB.Message.findById(ctx, mid);
            if (!message || message.deleted) {
                throw new NotFoundError();
            }

            let newAttachments: MessageAttachmentInput[] = [];

            if (message.attachmentsModern) {
                newAttachments = message.attachmentsModern.filter(a => a.type !== 'rich_attachment').map(a => {
                    delete a.id;
                    return a;
                });
            }

            await Modules.Messaging.editMessage(ctx, IDs.ConversationMessage.parse(args.mid), uid, {
                attachments: newAttachments,
                ignoreAugmentation: true,
            }, true);
            return true;
        }),

        betaReactionSet: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.mid), uid, args.reaction);
            return true;
        }),
        betaReactionRemove: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.mid), uid, args.reaction, true);
            return true;
        }),

        betaIntroSend: withUser(async (ctx, args, uid) => {
            throw new UserError('Deprecated API');
        }),
        betaIntroEdit: withUser(async (ctx, args, uid) => {
            throw new UserError('Deprecated API');
        }),

        //
        // Message Posts
        //

        alphaSendPostMessage: withUser(async (parent, args, uid) => {
            throw new UserError('Deprecated api');
        }),
        alphaEditPostMessage: withUser(async (parent, args, uid) => {
            throw new UserError('Deprecated api');
        }),
        alphaRespondPostMessage: withUser(async (parent, args, uid) => {
            throw new UserError('Deprecated api');
        })
    }
} as GQLResolver;