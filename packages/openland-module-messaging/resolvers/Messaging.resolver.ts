import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { IDs } from 'openland-module-api/IDs';
import { MessageAttachmentInput, MessageSpan } from '../MessageInput';
import { Store } from '../../openland-module-db/FDB';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { prepareLegacyMentionsInput } from './ModernMessage.resolver';
import { UserError } from '../../openland-errors/UserError';

export const Resolver: GQLResolver = {
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
                    filePreview,
                    previewFileId: null,
                    previewFileMetadata: null,
                    videoMetadata: null
                });
            }

            let spans: MessageSpan[] = [];

            if (mentions) {
                spans.push(...await prepareLegacyMentionsInput(ctx, args.message || '', mentions));
            }

            await Modules.Messaging.sendMessage(ctx, conversationId, uid!, {
                message: args.message,
                attachments,
                replyMessages,
                spans,
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
                    filePreview,
                    previewFileMetadata: null,
                    previewFileId: null,
                    videoMetadata: null
                });
            }

            await Modules.Messaging.editMessage(ctx, mid, uid, {
                message: args.message,
                attachments,
                replyMessages,
                spans: mentions ? await prepareLegacyMentionsInput(ctx, args.message || '', mentions) : [],
            }, true);
            return true;
        }),
        betaMessageDelete: withUser(async (ctx, args, uid) => {
            let forMeOnly = args.forMeOnly || false;
            if (forMeOnly) {
                throw new UserError('One side message deletion not available yet');
            }
            if (args.mid) {
                let messageId = IDs.ConversationMessage.parse(args.mid);
                await Modules.Messaging.deleteMessage(ctx, messageId, uid, forMeOnly);
                return true;
            } else if (args.mids) {
                let messageIds = args.mids.map(mid => IDs.ConversationMessage.parse(mid));
                await Modules.Messaging.deleteMessages(ctx, messageIds, uid, forMeOnly);
                return true;
            }
            return false;

        }),
        betaMessageDeleteAugmentation: withUser(async (ctx, args, uid) => {
            let mid = IDs.ConversationMessage.parse(args.mid);

            let message = await Store.Message.findById(ctx, mid);
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
            }, false);
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
    }
};
