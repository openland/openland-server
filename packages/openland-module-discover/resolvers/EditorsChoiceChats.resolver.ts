import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { IDs } from '../../openland-module-api/IDs';
import { withAny, withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import { NotFoundError } from '../../openland-errors/NotFoundError';

export const Resolver: GQLResolver = {
    EditorsChoiceChat: {
        id: src => IDs.DiscoverEditorsChoiceChat.serialize(src.id),
        image: src => src.image,
        chat: src => src.cid
    },
    Query: {
        discoverEditorsChoice: withAny(async (ctx, args) => {
            return await Store.EditorsChoiceChat.all.findAll(ctx);
        }),
        discoverEditorsChoiceChat: withAny(async (ctx, args) => {
            let chat = await Store.EditorsChoiceChat.findById(ctx, IDs.DiscoverEditorsChoiceChat.parse(args.id));
            if (!chat) {
                throw new NotFoundError();
            }
            return chat;
        })
    },
    Mutation: {
        discoverEditorsChoiceCreate: withUser(async (ctx, args, uid) => {
            await Modules.Media.saveFile(ctx, args.input.image.uuid);
            return await Modules.Discover.editorsChoiceChatsMediator.createChat(ctx, uid, {
                image: args.input.image,
                cid: IDs.Conversation.parse(args.input.cid)
            });
        }),
        discoverEditorsChoiceUpdate: withUser(async (ctx, args, uid) => {
            let input = args.input;
            if (input.image) {
                await Modules.Media.saveFile(ctx, input.image.uuid);
            }
            return await Modules.Discover.editorsChoiceChatsMediator.updateChat(
                ctx,
                uid,
                IDs.DiscoverEditorsChoiceChat.parse(args.id),
                {
                    image: input.image || undefined,
                    cid: input.cid ? IDs.Conversation.parse(input.cid) : undefined
                }
            );
        }),
        discoverEditorsChoiceDelete: withUser(async (ctx, args, uid) => {
            await Modules.Discover.editorsChoiceChatsMediator.deleteChat(ctx, uid, IDs.DiscoverEditorsChoiceChat.parse(args.id));
            return true;
        }),
    }
};
