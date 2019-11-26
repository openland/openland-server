import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { withUser } from 'openland-module-api/Resolvers';
import { validate, optional, enumString } from 'openland-utils/NewInputValidator';
import { TypingEvent } from './TypingEvent';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

export default {
    TypingType: {
        TEXT: 'text',
        PHOTO: 'photo',
        FILE: 'file'
    },
    TypingEvent: {
        type: (src: TypingEvent) => src.type,
        cancel: (src: TypingEvent) => src.cancel,
        conversation: (src: TypingEvent, args: {}, ctx: AppContext) => Store.Conversation.findById(ctx, src.conversationId),
        chat: (src: TypingEvent, args: {}, ctx: AppContext) => Store.Conversation.findById(ctx, src.conversationId),
        user: (src: TypingEvent) => src.userId,
    },
    Mutation: {
        alphaSetTyping: withUser(async (ctx, args, uid) => {
            await validate({ type: optional(enumString(['text', 'photo'])) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type || 'text');
            return 'ok';
        }),
        typingSend: withUser(async (ctx, args, uid) => {
            await validate({ type: optional(enumString(['text', 'photo'])) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type || 'text');
            return 'ok';
        }),
        typingCancel: withUser(async (ctx, args, uid) => {
            let chatId = IDs.Conversation.parse(args.conversationId);
            let members = await Modules.Messaging.room.findConversationMembers(ctx, chatId);
            await Modules.Typings.cancelTyping(uid, chatId, members);
            return 'ok';
        }),
    },
    Subscription: {
        typings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }

                return Modules.Typings.createTypingStream(ctx.auth.uid);
            }
        },
        conversationTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }

                return Modules.Typings.createTypingStream(ctx.auth.uid, conversationId);
            }
        },
        alphaSubscribeTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }

                return Modules.Typings.createTypingStream(ctx.auth.uid);
            }
        },
        alphaSubscribeChatTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (r, args, ctx) => {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }

                return Modules.Typings.createTypingStream(ctx.auth.uid, conversationId);
            }
        },
    }
} as GQLResolver;