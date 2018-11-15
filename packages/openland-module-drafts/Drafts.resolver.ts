import { withUser } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';

export default {
    Mutation: {
        conversationDraftUpdate: withUser<{ conversationId: string, message?: string }>(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);

            if (!args.message) {
                await Modules.Drafts.clearDraft(ctx, uid, conversationId);
            } else {
                await Modules.Drafts.saveDraft(ctx, uid, conversationId, args.message);
            }

            return 'ok';
        }),
        alphaSaveDraftMessage: withUser<{ conversationId: string, message?: string }>(async (ctx, args, uid) => {
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
        conversationDraft: withUser<{ conversationId: string }>(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return await Modules.Drafts.findDraft(ctx, uid, conversationId);
        }),
        alphaDraftMessage: withUser<{ conversationId: string }>(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return await Modules.Drafts.findDraft(ctx, uid, conversationId);
        }),
    }
};