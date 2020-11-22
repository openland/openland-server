import { withUser } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export const Resolver: GQLResolver = {
    Draft: {
        date: (src) => src.date,
        message: (src) => src.value,
        version: (src) => src.version
    },
    SequenceChat: {
        draft: (src, { }, ctx) => Modules.Drafts.findDraft(ctx, ctx.auth.uid!, src.cid)
    },
    Mutation: {
        conversationDraftUpdate: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            return Modules.Drafts.setDraft(ctx, uid, cid, args.message ? args.message : null);
        })
    }
};
