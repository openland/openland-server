import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser, withAuthFallback } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { IDs } from '../openland-module-api/IDs';
import { Store } from '../openland-module-db/FDB';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { withUser as withUserFromRoot } from '../openland-module-users/User.resolver';
import { ConversationVoice } from '../openland-module-db/store';
import { fastWatch } from '../openland-module-db/fastWatch';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';

export const Resolver: GQLResolver = {
    VoiceChat: {
        id: root => IDs.Conversation.serialize(root.id),
        active: root => root.active,
        adminsCount: (root, _, ctx) => Store.VoiceChatParticipantCounter.byId(root.id, 'admin').get(ctx),
        listenersCount: (root, _, ctx) => Store.VoiceChatParticipantCounter.byId(root.id, 'listener').get(ctx),
        speakersCount: (root, _, ctx) => Store.VoiceChatParticipantCounter.byId(root.id, 'speaker').get(ctx),
        speakers: (root, _, ctx) => Store.VoiceChatParticipant.speakers.findAll(ctx, root.id),
        listeners: (root, _, ctx) => Store.VoiceChatParticipant.listeners.findAll(ctx, root.id),
        title: root => root.title,
        me: withAuthFallback(async (root, args, ctx) => {
            let p = await Store.VoiceChatParticipant.findById(ctx, root.id, ctx.auth.uid!);
            if (p) {
                return p;
            }
            return null;
        }, null),
    },
    User: {
        currentVoiceChat: withUserFromRoot(async (ctx, user) => {
            let chat = await Store.VoiceChatParticipantActive.byId(user.id).get(ctx);
            if (chat === 0) {
                return null;
            }

            return await Store.ConversationVoice.findById(ctx, chat);
        }, true),
    },
    Mutation: {
        voiceChatCreate: withActivatedUser(async (ctx, { input }, uid) => {
            let chat = await Modules.VoiceChats.chats.createChat(ctx, input.title, uid);
            await Modules.VoiceChats.participants.joinChat(ctx, chat.id, uid, ctx.auth.tid!);
            return chat;
        }),
        voiceChatUpdate: withActivatedUser(async (ctx, { id, input }, uid) => {
            return await Modules.VoiceChats.chats.updateChat(ctx, uid, IDs.Conversation.parse(id), input.title);
        }),
        voiceChatEnd: withActivatedUser(async (ctx, { id }, uid) => {
            return await Modules.VoiceChats.chats.endChat(ctx, uid, IDs.Conversation.parse(id));
        })
    },
    Query: {
        voiceChat: async (root, args, ctx) => {
            let res = await Store.ConversationVoice.findById(ctx, IDs.Conversation.parse(args.id));
            if (!res) {
                throw new NotFoundError();
            }
            return res;
        }
    },
    Subscription: {
        voiceChatWatch: {
            resolve(obj: ConversationVoice) {
                return obj;
            },
            subscribe: async function * (_: any, args: { id: string }, parent: Context) {
                let cid = IDs.Conversation.parse(args.id);
                yield await inTx(parent, async (ctx) => (await Store.ConversationVoice.findById(ctx, cid))!);
                while (true) {
                    let changed = await fastWatch(parent, `voice-chat-${IDs.Conversation.parse(args.id)}`,
                        async (ctx) => (await inTx(ctx, (ctx2) => Store.ConversationVoice.findById(ctx2, cid)))!.metadata.versionCode
                    );
                    if (changed) {
                        yield await inTx(parent, async (ctx) => (await Store.ConversationVoice.findById(ctx, cid))!);
                    } else {
                        break;
                    }
                }
            }
        }
    }
};