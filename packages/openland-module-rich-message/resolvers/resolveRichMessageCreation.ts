import { MessageAttachmentFileInput } from '../../openland-module-messaging/MessageInput';
import { RichMessageInput, SlideInput as RichMessageSlideInput } from '../repositories/RichMessageRepository';
import { CommentSpan } from '../../openland-module-comments/repositories/CommentsRepository';
import { IDs, IdsFactory } from '../../openland-module-api/IDs';
import { Modules } from '../../openland-modules/Modules';
import { Nullable, OptionalNullable } from '../../openland-module-api/schema/SchemaUtils';
import { Context } from '@openland/context';
import { GQL } from '../../openland-module-api/schema/SchemaSpec';
import FileAttachmentInput = GQL.FileAttachmentInput;
import MessageSpanInput = GQL.MessageSpanInput;
import SlideInput = GQL.SlideInput;
import { FileInfo } from '../../openland-module-media/FileInfo';
import { UserError } from '../../openland-errors/UserError';

interface Input {
    message: OptionalNullable<string>;
    mentions: OptionalNullable<MentionInput[]>;
    fileAttachments: OptionalNullable<FileAttachmentInput[]>;
    spans: OptionalNullable<MessageSpanInput[]>;
    slides?: OptionalNullable<SlideInput[]>;
}

export interface MentionInput {
    chatId: Nullable<string>;
    userId: Nullable<string>;
    userIds: Nullable<string[]>;
    all: Nullable<boolean>;
    offset: number;
    length: number;
}

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
        }
    }
    return mentions;
}

export async function resolveRichMessageCreation(ctx: Context, input: Input): Promise<RichMessageInput> {
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

    //
    // Slides
    //
    let slides: RichMessageSlideInput[] = [];
    if (input.slides) {
        for (let slide of input.slides) {
            let imageMetadata: FileInfo | null = null;
            if (slide.cover) {
                imageMetadata = await Modules.Media.saveFile(ctx, slide.cover.uuid);
            }
            let coverAlign: string|null = null;

            if (slide.coverAlign === 'Top') {
                coverAlign = 'top';
            } else if (slide.coverAlign === 'Bottom') {
                coverAlign = 'bottom';
            } else if (slide.coverAlign === 'Cover') {
                coverAlign = 'cover';
            }

            let slideAttachments: ({ type: 'user', userId: number } | { type: 'room', roomId: number } | { type: 'organization', orgId: number })[] = [];

            if (slide.attachments) {
                for (let id of slide.attachments) {
                    let parsed = IdsFactory.resolve(id);
                    if (parsed.type === IDs.User) {
                        slideAttachments.push({ type: 'user', userId: parsed.id as number });
                    } else if (parsed.type === IDs.Conversation) {
                        slideAttachments.push({ type: 'room', roomId: parsed.id as number });
                    } else if (parsed.type === IDs.Organization) {
                        slideAttachments.push({ type: 'organization', orgId: parsed.id as number });
                    } else {
                        throw new UserError('only user, shared room and organization ids are supported');
                    }
                }
            }

            slides.push({
                type: 'text',
                text: slide.text || '',
                spans: [...resolveSpansInput(slide.spans || []), ...resolveMentionsInput(slide.mentions || [])],
                cover: slide.cover ? {
                    image: slide.cover,
                    info: imageMetadata!
                } : null,
                coverAlign: coverAlign as any,
                attachments: slideAttachments
            });
        }
    }

    return {
        message: input.message,
        attachments,
        spans,
        slides
    };
}