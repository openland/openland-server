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
import { resolveRichMessageCreation } from '../openland-module-rich-message/resolvers/resolveRichMessageCreation';
import { Capabilities } from '../openland-module-calls/repositories/CallScheduler';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { UserError } from '../openland-errors/UserError';

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
        pinnedMessage: async (src, _, ctx) => src.pinnedMessageId ? await Store.RichMessage.findById(ctx, src.pinnedMessageId) : null,
        parentRoom: src => src.parentChat
    },
    VoiceChatPinnedMessage: {
        id: src => IDs.RichMessage.serialize(src.id),
        message: src => src.text,
        spans: src => src.spans || []
    },
    User: {
        currentVoiceChat: withUserFromRoot(async (ctx, user) => {
            let chat = await Store.VoiceChatParticipantActive.byId(user.id).get(ctx);
            if (chat === 0) {
                return null;
            }

            let voiceChat = await Store.ConversationVoice.findById(ctx, chat);
            if (voiceChat?.isPrivate) {
                return null;
            }
            return voiceChat;
        }, true),
    },
    Mutation: {
        voiceChatCreate: withActivatedUser(async (ctx, { input }, uid) => {
            let chat = await Modules.VoiceChats.chats.createChat(ctx, {
                title: input.title,
                startedBy: uid,
                isPrivate: input.isPrivate || false
            });
            await Modules.VoiceChats.participants.joinChat(ctx, chat.id, uid, ctx.auth.tid!);
            return chat;
        }),
        voiceChatCreateWithMedia: withActivatedUser(async (ctx, { input, mediaInput, mediaKind }, uid) => {
            let chat = await Modules.VoiceChats.chats.createChat(ctx, {
                title: input.title,
                startedBy: uid,
                isPrivate: input.isPrivate || false
            });

            await Modules.VoiceChats.participants.joinChat(ctx, chat.id, uid, ctx.auth.tid!);

            let capabilities: Capabilities | null = null;
            if (mediaInput && mediaInput.capabilities) {
                capabilities = mediaInput.capabilities;
            }
            let res = await Modules.Calls.repo.addPeer(ctx, {
                cid: chat.id,
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
                conference: await Modules.Calls.repo.getOrCreateConference(ctx, chat.id),
                chat: chat
            };
        }),
        voiceChatCreateInChat: withActivatedUser(async (ctx, { input, mediaInput, mediaKind, cid }, uid) => {
            let chatId = IDs.Conversation.parse(cid);
            let isPrivate = false;

            let isAdmin = await Modules.Messaging.room.userHaveAdminPermissionsInRoom(ctx, uid, chatId);
            if (!isAdmin) {
                throw new AccessDeniedError();
            }
            let room = await Store.ConversationRoom.findById(ctx, chatId);
            let roomProfile = await Store.RoomProfile.findById(ctx, chatId);

            if (!room || !roomProfile) {
                throw new NotFoundError();
            }
            // Private for private chats
            if (room.kind === 'group') {
                isPrivate = true;
            }
            // Private for private communities & organizations
            if (room.oid) {
                let org = (await Store.Organization.findById(ctx, room.oid))!;
                if (org.private) {
                    isPrivate = true;
                }
                if (org.kind === 'organization') {
                    isPrivate = true;
                }
            }
            if (roomProfile.voiceChat) {
                throw new UserError(`This chat already have voice room`);
            }

            if (input.isPrivate) {
                isPrivate = true;
            }

            let chat = await Modules.VoiceChats.chats.createChat(ctx, {
                title: input.title,
                startedBy: uid,
                isPrivate,
                parentChatId: room.id
            });
            roomProfile.voiceChat = chat.id;
            await roomProfile.flush(ctx);

            // Send events
            await Modules.Messaging.room.markConversationAsUpdated(ctx, room.id, uid);
            await Modules.Messaging.room.notifyRoomUpdated(ctx, room.id);

            await Modules.VoiceChats.participants.joinChat(ctx, chat.id, uid, ctx.auth.tid!);

            let capabilities: Capabilities | null = null;
            if (mediaInput && mediaInput.capabilities) {
                capabilities = mediaInput.capabilities;
            }
            let res = await Modules.Calls.repo.addPeer(ctx, {
                cid: chat.id,
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
                conference: await Modules.Calls.repo.getOrCreateConference(ctx, chat.id),
                chat: chat
            };
        }),
        voiceChatUpdate: withActivatedUser(async (ctx, { id, input }, uid) => {
            return await Modules.VoiceChats.chats.updateChat(ctx, uid, IDs.Conversation.parse(id), {
                title: input.title,
                isPrivate: input.isPrivate === null ? undefined : input.isPrivate
            });
        }),
        voiceChatEnd: withActivatedUser(async (ctx, { id }, uid) => {
            return await Modules.VoiceChats.chats.endChat(ctx, uid, IDs.Conversation.parse(id));
        }),
        voiceChatSetPinnedMessage: withActivatedUser(async (ctx, { id, message, spans }, uid) => {
            let messageInput = await resolveRichMessageCreation(ctx, {
                message,
                spans,
                fileAttachments: [],
                mentions: []
            });
            return await Modules.VoiceChats.chats.setPinnedMessage(ctx, IDs.Conversation.parse(id), uid, messageInput);
        }),
        voiceChatDeletePinnedMessage: withActivatedUser(async (ctx, { id }, uid) => {
            return await Modules.VoiceChats.chats.deletePinnedMessage(ctx, IDs.Conversation.parse(id), uid);
        }),
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
            subscribe: async function* (_: any, args: { id: string }, parent: Context) {
                let cid = IDs.Conversation.parse(args.id);
                const initial = await inTx(parent, async (ctx) => (await Store.ConversationVoice.findById(ctx, cid))!);
                let version = initial.metadata.versionCode;
                yield initial;
                while (true) {
                    let changed = await fastWatch(parent, `voice-chat-${IDs.Conversation.parse(args.id)}`, version,
                        async (ctx) => (await inTx(ctx, async (ctx2) => Store.ConversationVoice.findById(ctx2, cid)))!.metadata.versionCode
                    );
                    if (changed.result) {
                        version = changed.version;
                        yield await inTx(parent, async (ctx) => (await Store.ConversationVoice.findById(ctx, cid))!);
                    } else {
                        break;
                    }
                }
            }
        }
    }
};