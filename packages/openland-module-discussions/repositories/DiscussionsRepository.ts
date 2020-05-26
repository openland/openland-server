import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { uuid } from '../../openland-utils/uuid';
import { UserError } from '../../openland-errors/UserError';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { NotFoundError } from '../../openland-errors/NotFoundError';

type DiscussionInput = {
    title: string;
    isDraft: boolean;
};

export class DiscussionsRepository {
    createDiscussion = async (parent: Context, uid: number, hubId: number, input: DiscussionInput) => {
        return inTx(parent, async ctx => {
            let hub = await Store.DiscussionHub.findById(ctx, hubId);
            if (!hub) {
                throw new UserError('Hub not found');
            }
            // Support public hubs only for now
            if (hub.description.type !== 'public') {
                throw new AccessDeniedError();
            }

            let id = uuid();

            // Create discussion
            let discussion = await Store.Discussion.create(ctx, id, {
                uid,
                hubId,
                title: input.title,
                state: input.isDraft ? 'draft' : 'published',
            });

            if (!input.isDraft) {
                discussion.publishedAt = Date.now();
            }
            await discussion.flush(ctx);

            return discussion;
        });
    }

    publishDraftDiscussion = async (parent: Context, uid: number, draftId: string) => {
        return inTx(parent, async ctx => {
            let discussion = await Store.Discussion.findById(ctx, draftId);
            if (!discussion) {
                throw new NotFoundError();
            }
            if (discussion.uid !== uid) {
                throw new AccessDeniedError();
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