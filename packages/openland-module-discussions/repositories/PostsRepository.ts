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

export type PostParagraphSpans =
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

export type PostInput = {
    hubId: number | null
    title: string | null
    content: PostContentInput[]
};

type TextParagraphInput = {
    type: 'text',
    text: string,
    spans: PostParagraphSpans[],
};

type ImageParagraphInput = {
    type: 'image',
    image: { image: ImageRef, info: FileInfo },
};

type H1ParagraphInput = {
    type: 'h1',
    text: string,
};

type H2ParagraphInput = {
    type: 'h2',
    text: string,
};

export type PostContentInput =
    | TextParagraphInput
    | ImageParagraphInput
    | H1ParagraphInput
    | H2ParagraphInput;

export type PostContent =
    | TextParagraph
    | ImageParagraph
    | H1Paragraph
    | H2Paragraph;

export type TextParagraph = {
    type: 'text'
    text: string
    spans: PostParagraphSpans[]
};

export type ImageParagraph = { type: 'image', image: { image: { uuid: string, crop: { x: number, y: number, w: number, h: number } | null }, info: { name: string, size: number, isImage: boolean, isStored: boolean, imageWidth: number | null, imageHeight: number | null, imageFormat: string | null, mimeType: string } } };

export type H1Paragraph = { type: 'h1', text: string };

export type H2Paragraph = { type: 'h2', text: string };

export class PostsRepository {
    createPostDraft = async (parent: Context, uid: number, input: PostInput) => {
        return inTx(parent, async ctx => {
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

            // Create discussion draft
            let draft = await Store.DiscussionDraft.create(ctx, id, {
                uid,
                hubId: input.hubId ? input.hubId : null,
                title: input.title || '',
                content: input.content || [],
                state: 'draft',
                version: 1
            });

            await draft.flush(ctx);

            return draft;
        });
    }

    editPostDraft = async (parent: Context, id: number, uid: number, input: PostInput) => {
        return inTx(parent, async ctx => {
            let draft = await Store.DiscussionDraft.findById(ctx, id);
            if (!draft) {
                throw new NotFoundError();
            }
            if (draft.uid !== uid) {
                throw new AccessDeniedError();
            }

            // Update values
            if (input.hubId) {
                draft.hubId = input.hubId;
            }
            if (input.title) {
                draft.title = input.title;
            }
            if (input.content) {
                draft.content = input.content;
            }

            // Update version
            draft.version++;
            // Show in drafts list
            draft.state = 'draft';

            await draft.flush(ctx);

            return draft;
        });
    }

    publishDraftPost = async (parent: Context, uid: number, draftId: number) => {
        return inTx(parent, async ctx => {
            let draft = await Store.DiscussionDraft.findById(ctx, draftId);
            if (!draft) {
                throw new NotFoundError();
            }
            if (draft.uid !== uid) {
                throw new AccessDeniedError();
            }
            if (!draft.hubId) {
                throw new UserError('Can\'t publish discussion with no hub');
            }
            if (draft.title.trim().length === 0) {
                throw new UserError('Title can\t be empty');
            }
            if (draft.content?.length === 0) {
                throw new UserError('Content can\t be empty');
            }
            if (draft.state !== 'draft') {
                throw new UserError('Discussion was already published');
            }

            let discussion = await Store.Discussion.findById(ctx, draftId);

            // Set draft as archived
            draft.state = 'archived';

            // Publish new discussion
            if (!discussion) {
                return await Store.Discussion.create(ctx, draftId, {
                    uid,
                    hubId: draft.hubId,
                    title: draft.title,
                    content: draft.content,
                    state: 'published',
                    version: draft.version,
                    publishedAt: Date.now()
                });
            } else {
                // Update published discussion
                if (draft.version <= discussion.version) {
                    throw new UserError('Draft is not changed');
                }
                if (draft.hubId !== discussion.hubId) {
                    throw new UserError('Can\'t change hub after publish');
                }

                discussion.title = draft.title;
                discussion.content = draft.content;
                discussion.state = 'published';
                discussion.version = draft.version;
                await discussion.flush(ctx);
                return discussion;
            }
        });
    }
}