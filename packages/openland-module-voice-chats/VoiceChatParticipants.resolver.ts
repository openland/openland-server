import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Context } from '@openland/context';
import { Modules } from '../openland-modules/Modules';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import VoiceChatParticipantRoot = GQLRoots.VoiceChatParticipantRoot;
import { IDs } from '../openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { VoiceChatParticipant } from '../openland-module-db/store';
import { Capabilities } from '../openland-module-calls/repositories/CallScheduler';
import { NotFoundError } from '../openland-errors/NotFoundError';

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

const resolveParticipantStatus = (p: VoiceChatParticipant) => {
    if (p.status !== 'joined') {
        return p.status;
    } else {
        return p.role || 'left';
    }
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
        status: root => resolveParticipantStatus(root),
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
        },
        voiceChatHandRaised: async (root, args, ctx) => {
            let query = await Store.VoiceChatParticipant.handRaised.query(ctx, IDs.Conversation.parse(args.id), { afterCursor: args.after });
            return {
                cursor: query.cursor,
                items: query.items,
                haveMore: query.haveMore
            };
        },
    },
    Mutation: {
        voiceChatJoin: withActivatedUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            let chat = await Store.ConversationVoice.findById(ctx, cid);
            if (!chat) {
                throw new NotFoundError();
            }
            let joinAsAdmin = false;
            if (chat.parentChat) {
                joinAsAdmin = await Modules.Messaging.room.userHaveAdminPermissionsInRoom(ctx, uid, chat.parentChat);
            }

            await Modules.VoiceChats.participants.joinChat(ctx, cid, uid, ctx.auth.tid!, joinAsAdmin ? 'admin' : null);
            return (await Store.ConversationVoice.findById(ctx, cid))!;
        }),
        voiceChatJoinWithMedia: withActivatedUser(async (ctx, {id, mediaInput, mediaKind}, uid) => {
            let cid = IDs.Conversation.parse(id);
            await Modules.VoiceChats.participants.joinChat(ctx, cid, uid, ctx.auth.tid!);

            let capabilities: Capabilities | null = null;
            if (mediaInput && mediaInput.capabilities) {
                capabilities = mediaInput.capabilities;
            }
            let res = await Modules.Calls.repo.addPeer(ctx, {
                cid,
                uid,
                tid: ctx.auth.tid!,
                timeout: 60000,
                kind: mediaKind === 'STREAM' ? 'stream' : 'conference',
                capabilities,
                media: mediaInput?.media,
                ip: ctx.req.ip || 'unknown'
            });

            return {
                peerId: IDs.ConferencePeer.serialize(res.id),
                conference: await Modules.Calls.repo.getOrCreateConference(ctx, cid),
                chat: (await Store.ConversationVoice.findById(ctx, cid))!
            };
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
        })
    }
};