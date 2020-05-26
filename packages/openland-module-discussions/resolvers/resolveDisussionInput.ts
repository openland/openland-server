import { GQL } from '../../openland-module-api/schema/SchemaSpec';
import DiscussionInputGQL = GQL.DiscussionInput;
import { DiscussionContentInput, DiscussionInput } from '../repositories/DiscussionsRepository';
import { resolveSpansInput } from '../../openland-module-rich-message/resolvers/resolveRichMessageCreation';
import { UserError } from '../../openland-errors/UserError';
import { Modules } from '../../openland-modules/Modules';
import { Context } from '@openland/context';
import { IDs } from '../../openland-module-api/IDs';

export async function resolveDiscussionInput(ctx: Context, input: DiscussionInputGQL): Promise<DiscussionInput> {
    let content: DiscussionContentInput[] = [];
    if (input.content) {
        for (let part of input.content) {
            if (part.type === 'Text') {
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
        }
    }

    return {
        title: input.title!,
        content,
        hubId: input.hub ? IDs.Hub.parse(input.hub) : null
    };
}