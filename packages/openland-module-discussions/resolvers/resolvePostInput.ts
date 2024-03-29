import { GQL } from '../../openland-module-api/schema/SchemaSpec';
import PostInputGQL = GQL.PostInput;
import { PostContentInput, PostInput, PostParagraphSpans } from '../repositories/PostsRepository';
import { UserError } from '../../openland-errors/UserError';
import { Modules } from '../../openland-modules/Modules';
import { Context } from '@openland/context';
import { IDs } from '../../openland-module-api/IDs';
import PostSpanInput = GQL.PostSpanInput;

export function resolveSpansInput(input: PostSpanInput[] = []) {
    let spans: PostParagraphSpans[] = [];
    for (let span of input) {
        if (span.type === 'Bold') {
            spans.push({offset: span.offset, length: span.length, type: 'bold_text'});
        } else if (span.type === 'Italic') {
            spans.push({offset: span.offset, length: span.length, type: 'italic_text'});
        } else if (span.type === 'Irony') {
            spans.push({offset: span.offset, length: span.length, type: 'irony_text'});
        }
    }
    return spans;
}

export async function resolveDiscussionInput(ctx: Context, input: PostInputGQL): Promise<PostInput> {
    let content: PostContentInput[] = [];
    if (input.content) {
        for (let part of input.content) {
            if (part.type === 'Text') {
                if (part.text?.includes('\n')) {
                    throw new UserError('Line breaks should be divided to separate paragraph');
                }
                content.push({
                    type: 'text',
                    text: part.text || '',
                    spans: [...resolveSpansInput(part.spans || [])]
                });
            }
            if (part.type === 'Image') {
                if (!part.image) {
                    throw new UserError('Image paragraph should contain image');
                }
                let imageMetadata = await Modules.Media.saveFile(ctx, part.image.uuid);

                content.push({
                    type: 'image',
                    image: {
                        image: part.image,
                        info: imageMetadata!
                    }
                });
            }
            if (part.type === 'H1') {
                if (part.text?.includes('\n')) {
                    throw new UserError('Line breaks should be divided to separate paragraph');
                }
                content.push({
                    type: 'h1',
                    text: part.text || ''
                });
            }
            if (part.type === 'H2') {
                if (part.text?.includes('\n')) {
                    throw new UserError('Line breaks should be divided to separate paragraph');
                }
                content.push({
                    type: 'h2',
                    text: part.text || ''
                });
            }
        }
    }

    return {
        title: input.title!,
        content,
        hubId: input.hub ? IDs.Hub.parse(input.hub) : null
    };
}