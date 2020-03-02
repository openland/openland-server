import { withUser } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export const Resolver: GQLResolver = {
    Mutation: {
        conversationDraftUpdate: withUser(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);

            if (!args.message) {
                await Modules.Drafts.clearDraft(ctx, uid, conversationId);
            } else {
                await Modules.Drafts.saveDraft(ctx, uid, conversationId, args.message);
            }

            return 'ok';
        }),
        alphaSaveDraftMessage: withUser(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);

            if (!args.message) {
                await Modules.Drafts.clearDraft(ctx, uid, conversationId);
            } else {
                await Modules.Drafts.saveDraft(ctx, uid, conversationId, args.message);
            }

            return 'ok';
        }),
    },
    Query: {
        conversationDraft: withUser(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return await Modules.Drafts.findDraft(ctx, uid, conversationId);
        }),
        alphaDraftMessage: withUser(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return await Modules.Drafts.findDraft(ctx, uid, conversationId);
        }),
    }
};
