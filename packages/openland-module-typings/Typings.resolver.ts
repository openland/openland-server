import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { withUser } from 'openland-module-api/Resolvers';
import { validate, optional, enumString } from 'openland-utils/NewInputValidator';
import { TypingEvent } from './TypingEvent';
import { FDB } from 'openland-module-db/FDB';
import { GQL } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';

export default {
    TypingType: {
        TEXT: 'text',
        PHOTO: 'photo',
        FILE: 'file'
    },
    TypingEvent: {
        type: (src: TypingEvent) => src.type,
        cancel: (src: TypingEvent) => src.cancel,
        conversation: (src: TypingEvent, args: {}, ctx: AppContext) => FDB.Conversation.findById(ctx, src.conversationId),
        user: (src: TypingEvent) => src.userId,
    },
    Mutation: {
        alphaSetTyping: withUser<GQL.MutationAlphaSetTypingArgs>(async (ctx, args, uid) => {
            await validate({ type: optional(enumString(['text', 'photo'])) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type || 'text');
            return 'ok';
        }),
        typingSend: withUser<GQL.MutationTypingSendArgs>(async (ctx, args, uid) => {
            await validate({ type: optional(enumString(['text', 'photo'])) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type || 'text');
            return 'ok';
        }),
        typingCancel: withUser<GQL.MutationTypingCancelArgs>(async (ctx, args, uid) => {
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
            subscribe: async function (_: any, args: any, ctx: AppContext) {
                if (!ctx.auth.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Typings.createTypingStream(ctx.auth.uid);
            }
        },
        conversationTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { conversationId: string }, ctx: AppContext) {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                if (!ctx.auth.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Typings.createTypingStream(ctx.auth.uid, conversationId);
            }
        },
        alphaSubscribeTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: any, ctx: AppContext) {
                if (!ctx.auth.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Typings.createTypingStream(ctx.auth.uid);
            }
        },
        alphaSubscribeChatTypings: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { conversationId: string }, ctx: AppContext) {
                let conversationId = IDs.Conversation.parse(args.conversationId);

                if (!ctx.auth.uid) {
                    throw Error('Not logged in');
                }

                return Modules.Typings.createTypingStream(ctx.auth.uid, conversationId);
            }
        },
    }
};