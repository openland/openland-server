import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { UserError } from '../../openland-errors/UserError';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { resolveSequenceNumber } from '../../openland-module-db/resolveSequenceNumber';
import {
    AllMentionSpan,
    BoldTextSpan, CodeBlockTextSpan, DateTextSpan, InlineCodeTextSpan, InsaneTextSpan, IronyTextSpan, ItalicTextSpan,
    LinkSpan, LoudTextSpan,
    MultiUserMentionSpan,
    RoomMentionSpan, RotatingTextSpan,
    UserMentionSpan
} from '../../openland-module-messaging/MessageInput';
import { ImageRef } from '../../openland-module-media/ImageRef';
import { FileInfo } from '../../openland-module-media/FileInfo';

export type DiscussionParagraphSpans =
    UserMentionSpan |
    MultiUserMentionSpan |
    RoomMentionSpan |
    LinkSpan |
    BoldTextSpan |
    ItalicTextSpan |
    IronyTextSpan |
    InlineCodeTextSpan |
    CodeBlockTextSpan |
    InsaneTextSpan |
    LoudTextSpan |
    RotatingTextSpan |
    DateTextSpan |
    AllMentionSpan;

export type DiscussionInput = {
    hubId: number | null
    title: string | null
    content: DiscussionContentInput[]
};

type TextParagraphInput = {
    type: 'text',
    text: string,
    spans: DiscussionParagraphSpans[],
};

type ImageParagraphInput = {
    type: 'image',
    image: { image: ImageRef, info: FileInfo },
};

export type DiscussionContentInput =
    | TextParagraphInput
    | ImageParagraphInput;

export type DiscussionContent = TextParagraph | ImageParagraph;

export type TextParagraph = {
    type: 'text'
    text: string
    spans: DiscussionParagraphSpans[]
};

export type ImageParagraph = { type: 'image', image: { image: { uuid: string, crop: { x: number, y: number, w: number, h: number } | null }, info: { name: string, size: number, isImage: boolean, isStored: boolean, imageWidth: number | null, imageHeight: number | null, imageFormat: string | null, mimeType: string } } };

export class DiscussionsRepository {
    createDiscussion = async (parent: Context, uid: number, input: DiscussionInput, isDraft: boolean) => {
        return inTx(parent, async ctx => {
            if (!isDraft && !input.hubId) {
                throw new UserError('Can\'t publish discussion with no hub');
            }

            // Access check
            if (input.hubId) {
                let hub = await Store.DiscussionHub.findById(ctx, input.hubId);
                if (!hub) {
                    throw new UserError('Hub not found');
                }
                // Support public hubs only for now
                if (hub.description.type !== 'public') {
                    throw new AccessDeniedError();
                }
            }

            // Resolve next id
            let id = await resolveSequenceNumber(ctx, 'discussion-id');

            // Create discussion
            let discussion = await Store.Discussion.create(ctx, id, {
                uid,
                hubId: input.hubId ? input.hubId : null,
                title: input.title || '',
                content: input.content || [],
                state: isDraft ? 'draft' : 'published',
            });

            if (!isDraft) {
                discussion.publishedAt = Date.now();
            }
            await discussion.flush(ctx);

            return discussion;
        });
    }

    editDiscussion = async (parent: Context, id: number, uid: number, input: DiscussionInput) => {
        return inTx(parent, async ctx => {
            let discussion = await Store.Discussion.findById(ctx, id);
            if (!discussion) {
                throw new NotFoundError();
            }
            if (discussion.uid !== uid) {
                throw new AccessDeniedError();
            }

            // Update values
            if (input.hubId) {
                discussion.hubId = input.hubId;
            }
            if (input.title) {
                discussion.title = input.title;
            }
            if (input.content) {
                discussion.content = input.content;
            }
            await discussion.flush(ctx);

            return discussion;
        });
    }

    publishDraftDiscussion = async (parent: Context, uid: number, draftId: number) => {
        return inTx(parent, async ctx => {
            let discussion = await Store.Discussion.findById(ctx, draftId);
            if (!discussion) {
                throw new NotFoundError();
            }
            if (discussion.uid !== uid) {
                throw new AccessDeniedError();
            }
            if (!discussion.hubId) {
                throw new UserError('Can\'t publish discussion with no hub');
            }
            if (discussion.title.trim().length === 0) {
                throw new UserError('Title can\t be empty');
            }
            if (discussion.content?.length === 0) {
                throw new UserError('Content can\t be empty');
            }
            if (discussion.state !== 'draft') {
                throw new UserError('Discussion was already published');
            }

            // Set published
            discussion.state = 'published';
            discussion.publishedAt = Date.now();
            await discussion.flush(ctx);

            return discussion;
        });
    }
}