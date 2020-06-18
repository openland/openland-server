import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { withUser } from 'openland-module-api/Resolvers';
import { validate, optional, enumString } from 'openland-utils/NewInputValidator';
import { TypingEvent } from './TypingEvent';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import TypingTypeRoot = GQLRoots.TypingTypeRoot;
import { Context } from '@openland/context';

const TypingType = {
    TEXT: 'text',
    PHOTO: 'photo',
    FILE: 'file',
    VIDEO: 'video',
    STICKER: 'sticker'
};

const TypingTypeValues = Object.values(TypingType);

export const Resolver: GQLResolver = {
    TypingType: {
        TEXT: 'text',
        PHOTO: 'photo',
        FILE: 'file',
        VIDEO: 'video',
        STICKER: 'sticker'
    },
    TypingEvent: {
        type: (src: TypingEvent) => src.cancel ? 'text' : src.type,
        cancel: (src: TypingEvent) => src.cancel,
        conversation: async (src: TypingEvent, args: {}, ctx: Context) => (await Store.Conversation.findById(ctx, src.conversationId))!,
        chat: async (src: TypingEvent, args: {}, ctx: Context) => (await Store.Conversation.findById(ctx, src.conversationId))!,
        user: (src: TypingEvent) => src.userId,
    },
    Mutation: {
        alphaSetTyping: withUser(async (ctx, args, uid) => {
            await validate({ type: optional(enumString(TypingTypeValues)) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type as TypingTypeRoot || 'text');
            return 'ok';
        }),
        typingSend: withUser(async (ctx, args, uid) => {
            await validate({ type: optional(enumString(TypingTypeValues)) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, args.type || 'text');
            return 'ok';
        }),
        typingCancel: withUser(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(uid, conversationId, 'cancel');
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
};
