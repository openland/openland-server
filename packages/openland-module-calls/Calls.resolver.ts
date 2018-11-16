import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { ConferenceRoom } from 'openland-module-db/schema';
import { Context } from 'openland-utils/Context';

export default {
    Conference: {
        id: (src: ConferenceRoom) => IDs.Conference.serialize(src.id),
        members: (src: ConferenceRoom, args: {}, ctx: Context) => Modules.Calls.repo.findActiveMembers(ctx, src.id)
    },
    Query: {
        conference: withUser<{ id: string }, any>(async (ctx, args, uid) => {
            return Modules.Calls.repo.findConference(ctx, IDs.Conversation.parse(args.id));
        })
    },
    Mutation: {
        conferenceJoin: withUser<{ id: string }, any>(async (ctx, args, uid) => {
            await Modules.Calls.repo.conferenceJoin(ctx, IDs.Conversation.parse(args.id), uid, ctx.auth.tid!, 15000);
            return Modules.Calls.repo.findConference(ctx, IDs.Conversation.parse(args.id));
        }),
        conferenceLeave: withUser<{ id: string }, any>(async (ctx, args, uid) => {
            await Modules.Calls.repo.conferenceLeave(ctx, IDs.Conversation.parse(args.id), uid, ctx.auth.tid!);
            return Modules.Calls.repo.findConference(ctx, IDs.Conversation.parse(args.id));
        }),
        conferenceKeepAlive: withUser<{ id: string }, any>(async (ctx, args, uid) => {
            await Modules.Calls.repo.conferenceJoin(ctx, IDs.Conversation.parse(args.id), uid, ctx.auth.tid!, 15000);
            return Modules.Calls.repo.findConference(ctx, IDs.Conversation.parse(args.id));
        })
    }
};