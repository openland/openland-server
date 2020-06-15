import { Context } from '@openland/context';
import { GQL } from '../../openland-module-api/schema/SchemaSpec';
import MutationBetaAddCommentArgs = GQL.MutationBetaAddCommentArgs;
import { CommentInput, CommentSpan } from '../repositories/CommentsRepository';
import { MessageAttachmentFileInput } from '../../openland-module-messaging/MessageInput';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';
import MessageSpanInput = GQL.MessageSpanInput;
import MentionInput = GQL.MentionInput;

export function resolveSpansInput(input: MessageSpanInput[] = []) {
    let spans: CommentSpan[] = [];
    for (let span of input) {
        if (span.type === 'Bold') {
            spans.push({offset: span.offset, length: span.length, type: 'bold_text'});
        } else if (span.type === 'Italic') {
            spans.push({offset: span.offset, length: span.length, type: 'italic_text'});
        } else if (span.type === 'InlineCode') {
            spans.push({offset: span.offset, length: span.length, type: 'inline_code_text'});
        } else if (span.type === 'CodeBlock') {
            spans.push({offset: span.offset, length: span.length, type: 'code_block_text'});
        } else if (span.type === 'Irony') {
            spans.push({offset: span.offset, length: span.length, type: 'irony_text'});
        } else if (span.type === 'Insane') {
            spans.push({offset: span.offset, length: span.length, type: 'insane_text'});
        } else if (span.type === 'Loud') {
            spans.push({offset: span.offset, length: span.length, type: 'loud_text'});
        } else if (span.type === 'Rotating') {
            spans.push({offset: span.offset, length: span.length, type: 'rotating_text'});
        }
    }
    return spans;
}

export function resolveMentionsInput(input: MentionInput[] = []) {
    let mentions: CommentSpan[] = [];
    for (let mention of input) {
        if (mention.userId) {
            mentions.push({
                type: 'user_mention',
                offset: mention.offset,
                length: mention.length,
                user: IDs.User.parse(mention.userId!)
            });
        } else if (mention.chatId) {
            mentions.push({
                type: 'room_mention',
                offset: mention.offset,
                length: mention.length,
                room: IDs.Conversation.parse(mention.chatId!)
            });
        } else if (mention.userIds) {
            mentions.push({
                type: 'multi_user_mention',
                offset: mention.offset,
                length: mention.length,
                users: mention.userIds.map(id => IDs.User.parse(id))
            });
        } else if (mention.all) {
            mentions.push({
                type: 'all_mention',
                offset: mention.offset,
                length: mention.length,
            });
        } else if (mention.orgId) {
            mentions.push({
                type: 'organization_mention',
                offset: mention.offset,
                length: mention.length,
                organization: IDs.Organization.parse(mention.orgId)
            });
        }
    }
    return mentions;
}

export async function resolveCommentInput(ctx: Context, input: MutationBetaAddCommentArgs): Promise<CommentInput> {
    let spans: CommentSpan[] = [];

    //
    // Mentions
    //
    if (input.mentions) {
        spans.push(...resolveMentionsInput(input.mentions || []));
    }

    //
    // File attachments
    //
    let attachments: MessageAttachmentFileInput[] = [];
    if (input.fileAttachments) {
        for (let fileInput of input.fileAttachments) {
            let fileMetadata = await Modules.Media.saveFile(ctx, fileInput.fileId);
            let filePreview: string | null = null;

            if (fileMetadata.isImage) {
                filePreview = await Modules.Media.fetchLowResPreview(ctx, fileInput.fileId);
            }

            attachments.push({
                type: 'file_attachment',
                fileId: fileInput.fileId,
                fileMetadata: fileMetadata || null,
                filePreview: filePreview || null
            });
        }
    }

    //
    //  Spans
    //
    if (input.spans) {
        spans.push(...resolveSpansInput(input.spans || []));
    }

    return {
        message: input.message,
        attachments,
        spans,
    };
}