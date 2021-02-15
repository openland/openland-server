import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { IDs } from '../openland-module-api/IDs';
import { Store } from '../openland-module-db/FDB';
import { NotFoundError } from '../openland-errors/NotFoundError';

export const Resolver: GQLResolver = {
    VoiceChat: {
        id: root => IDs.Conversation.serialize(root.id),
        active: root => root.active,
        adminsCount: (root, _, ctx) => Store.VoiceChatParticipantCounter.byId(root.id, 'admin').get(ctx),
        listenersCount: (root, _, ctx) => Store.VoiceChatParticipantCounter.byId(root.id, 'listener').get(ctx),
        speakersCount: (root, _, ctx) => Store.VoiceChatParticipantCounter.byId(root.id, 'speaker').get(ctx),
        speakers: (root, _, ctx) => Store.VoiceChatParticipant.speakers.findAll(ctx, root.id),
        title: root => root.title
    },
    Mutation: {
        voiceChatCreate: withActivatedUser(async (ctx, { input }, uid) => {
            let chat = await Modules.VoiceChats.chats.createChat(ctx, input.title);
            await Modules.VoiceChats.participants.joinChat(ctx, chat.id, uid, 'admin');
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
        },

        activeVoiceChats: withActivatedUser(async (ctx, args, uid) => {
            let res = await Store.ConversationVoice.active.query(ctx, { limit: args.first, afterCursor: args.after });
            return {
                items: res.items,
                cursor: res.cursor || null
            };
        }),
    }
};