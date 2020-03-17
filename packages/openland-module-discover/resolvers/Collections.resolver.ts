import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { IDs } from '../../openland-module-api/IDs';
import { withUser, withAny } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';

export const Resolver: GQLResolver = {
    DiscoverChatsCollection: {
        id: src => IDs.DiscoverChatsCollection.serialize(src.id),
        title: src => src.title,
        image: src => src.image,
        chatsCount: src => src.chatIds.length,
        chats: src => src.chatIds
    },
    DiscoverChatsCollectionConnection: {
        items: src => src.items,
        cursor: src => src.cursor || null
    },

    Query: {
        discoverCollections: withUser(async (ctx, args, uid) => {
            let afterId = args.after ? IDs.DiscoverChatsCollection.parse(args.after) : null;
            if (!args.first || args.first <= 0) {
                return { items: [], cursor: undefined };
            }
            let afterExists = afterId && await Store.EditorsChoiceChatsCollection.findById(ctx, afterId);
            let {items, haveMore} = await Store.EditorsChoiceChatsCollection.collection.query(ctx, {
                limit: args.first,
                after: afterExists ? afterId : undefined
            });
            return {
                items,
                cursor: haveMore ? IDs.DiscoverChatsCollection.serialize(items[items.length - 1].id) : undefined
            };
        }),
        discoverCollection: withAny(async (ctx, args) => {
            return await Store.EditorsChoiceChatsCollection.findById(ctx, IDs.DiscoverChatsCollection.parse(args.id));
        })
    },
    Mutation: {
        discoverCollectionsCreate: withUser(async (ctx, args, uid) => {
            await Modules.Media.saveFile(ctx, args.collection.image.uuid);
            return await Modules.Discover.collectionsMediator.createCollection(ctx, uid, {
                title: args.collection.title,
                image: args.collection.image,
                chatIds: args.collection.chatIds.map(id => IDs.Conversation.parse(id))
            });
        }),
        discoverCollectionsUpdate: withUser(async (ctx, args, uid) => {
            let input = args.input;
            if (args.input.image) {
                await Modules.Media.saveFile(ctx, args.input.image.uuid);
            }
            return await Modules.Discover.collectionsMediator.updateCollection(
                ctx,
                uid,
                IDs.DiscoverChatsCollection.parse(args.id),
                {
                    title: input.title || undefined,
                    image: input.image || undefined,
                    chatIds: input.chatIds ? input.chatIds.map(id => IDs.Conversation.parse(id)) : undefined
                }
            );
        }),
        discoverCollectionsDelete: withUser(async (ctx, args, uid) => {
            await Modules.Discover.collectionsMediator.deleteCollection(ctx, uid, IDs.DiscoverChatsCollection.parse(args.id));
            return true;
        }),
    }
};
