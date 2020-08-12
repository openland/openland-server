import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { withUser } from 'openland-module-api/Resolvers';
import { validate, optional, enumString } from 'openland-utils/NewInputValidator';
import { TypingEvent } from './TypingEvent';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
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
        type: (src: TypingEvent) => src.type === 'cancel' ? 'text' : src.type,
        cancel: (src: TypingEvent) => src.type === 'cancel',
        conversation: async (src: TypingEvent, args: {}, ctx: Context) => (await Store.Conversation.findById(ctx, src.cid))!,
        chat: async (src: TypingEvent, args: {}, ctx: Context) => (await Store.Conversation.findById(ctx, src.cid))!,
        user: (src: TypingEvent) => src.uid,
    },
    Mutation: {
        typingSend: withUser(async (ctx, args, uid) => {
            await validate({ type: optional(enumString(TypingTypeValues)) }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(ctx, uid, conversationId, args.type || 'text');
            return 'ok';
        }),
        typingCancel: withUser(async (ctx, args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            await Modules.Typings.setTyping(ctx, uid, conversationId, 'cancel');
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
        }
    }
};
