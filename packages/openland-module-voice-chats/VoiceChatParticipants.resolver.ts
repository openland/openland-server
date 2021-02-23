import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Context } from '@openland/context';
import { Modules } from '../openland-modules/Modules';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import VoiceChatParticipantRoot = GQLRoots.VoiceChatParticipantRoot;
import { IDs } from '../openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { withActivatedUser } from '../openland-module-api/Resolvers';

const ensureHasAccess = <TArgs, TResult>(fn: (root: VoiceChatParticipantRoot, args: TArgs, ctx: Context) => Promise<TResult>, fallback: TResult) =>
  async (root: VoiceChatParticipantRoot, args: TArgs, ctx: Context): Promise<TResult> => {
    if (!ctx.auth.uid) {
        return fallback;
    }
    if (ctx.auth.uid !== root.uid && !await Modules.VoiceChats.participants.isAdmin(ctx, root.cid, ctx.auth.uid)) {
        return fallback;
    }

    return fn(root, args, ctx);
};

export const Resolver: GQLResolver = {
    VoiceChatParticipantStatus: {
        LISTENER: 'listener',
        SPEAKER: 'speaker',
        ADMIN: 'admin',
        LEFT: 'left',
        KICKED: 'kicked',
    },
    VoiceChatParticipant: {
        id: root => IDs.VoiceChatParticipant.serialize(root.cid + '_' + root.uid),
        handRaised: ensureHasAccess(async (root) => root.handRaised, null),
        status: root => root.status,
        user: root => root.uid,
    },
    VoiceChatParticipantConnection: {
        items: root => root.items,
        cursor: root => root.cursor || null,
    },
    Query: {
        voiceChatListeners: async (root, args, ctx) => {
            let query = await Store.VoiceChatParticipant.listeners.query(ctx, IDs.Conversation.parse(args.id), { afterCursor: args.after });
            return {
                cursor: query.cursor,
                items: query.items,
                haveMore: query.haveMore
            };
        }
    },
    Mutation: {
        voiceChatJoin: withActivatedUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            await Modules.VoiceChats.participants.joinChat(ctx, cid, uid, ctx.auth.tid!);
            return (await Store.ConversationVoice.findById(ctx, cid))!;
        }),
        voiceChatRaiseHand: withActivatedUser(async (ctx, args, uid) => {
            await Modules.VoiceChats.participants.updateHandRaised(
                ctx,
                IDs.Conversation.parse(args.id),
                uid,
                args.raised
            );
            return true;
        }),
        voiceChatLeave: withActivatedUser(async (ctx, args, uid) => {
            await Modules.VoiceChats.participants.leaveChat(ctx, IDs.Conversation.parse(args.id), uid);
            return true;
        }),

        voiceChatPromote: withActivatedUser(async (ctx, args, uid) => {
            await Modules.VoiceChats.participants.promoteParticipant(
                ctx,
                uid,
                IDs.Conversation.parse(args.id),
                IDs.User.parse(args.uid)
            );
            return true;
        }),
        voiceChatDemote: withActivatedUser(async (ctx, args, uid) => {
            await Modules.VoiceChats.participants.demoteParticipant(
                ctx,
                uid,
                IDs.Conversation.parse(args.id),
                IDs.User.parse(args.uid)
            );
            return true;
        }),
        voiceChatUpdateAdmin: withActivatedUser(async (ctx, args, uid) => {
            await Modules.VoiceChats.participants.updateAdminRights(
                ctx,
                uid,
                IDs.Conversation.parse(args.id),
                IDs.User.parse(args.uid),
                args.admin,
            );
            return true;
        }),
        voiceChatKick: withActivatedUser(async (ctx, args, uid) => {
            await Modules.VoiceChats.participants.kick(
                ctx,
                uid,
                IDs.Conversation.parse(args.id),
                IDs.User.parse(args.uid)
            );
            return true;
        }),
    }
};