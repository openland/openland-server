import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { IDs } from '../openland-module-api/IDs';
import { AppContext } from '../openland-modules/AppContext';
import { MaybePromise } from '../openland-module-api/schema/SchemaUtils';
import { Comment, Message, Sticker, StickerPack } from 'openland-module-db/store';
import { Store } from 'openland-module-db/FDB';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import StickerPackRoot = GQLRoots.StickerPackRoot;
import StickerRoot = GQLRoots.StickerRoot;

function withStickerPackId<T, R>(handler: (ctx: AppContext, src: number, args: T) => MaybePromise<R>) {
    return (src: StickerPackRoot, args: T, ctx: AppContext) => {
        return typeof src === 'number' ? handler(ctx, src, args) : handler(ctx, src.id, args);
    };
}

function withStickerPack<T, R>(handler: (ctx: AppContext, pack: StickerPack, args: T) => MaybePromise<R>) {
    return async (src: StickerPackRoot, args: T, ctx: AppContext) => {
        if (typeof src === 'number') {
            let pack = await Store.StickerPack.findById(ctx, src);
            if (!pack) {
                throw new Error('Invalid sticker pack id');
            }
            return handler(ctx, pack, args);
        } else {
            return handler(ctx, src, args);
        }
    };
}

function withSticker<T, R>(handler: (ctx: AppContext, sticker: Sticker, args: T) => MaybePromise<R>) {
    return async (src: StickerRoot, args: T, ctx: AppContext) => {
        if (typeof src === 'string') {
            let sticker = await Store.Sticker.findById(ctx, src);
            if (!sticker) {
                throw new Error('Invalid sticker id');
            }
            return handler(ctx, sticker, args);
        } else {
            return handler(ctx, src, args);
        }
    };
}

export default {
    Sticker: {
        __resolveType() {
            return 'ImageSticker';
        }
    },
    StickerPack: {
        id: withStickerPackId((ctx, id) => IDs.StickerPack.serialize(id)),
        author: withStickerPack(async (ctx, pack) => pack.uid),
        title: withStickerPack((ctx, pack) => pack.title),
        usesCount: withStickerPack((ctx, pack) => pack.usesCount),
        stickers: withStickerPackId(async (ctx, id) => {
            return await Store.Sticker.packActive.findAll(ctx, id);
        }),
        published: withStickerPack((ctx, pack) => pack.published),
    },
    UserStickers: {
        favourites: root => root.favouriteIds,
        packs: root => root.packIds
    },
    ImageSticker: {
        image: withSticker((ctx, sticker) => sticker.image),
        emoji: withSticker((ctx, sticker) => sticker.emoji),
        pack: withSticker((ctx, sticker) => sticker.packId),
        id: withSticker((ctx, sticker) => IDs.Sticker.serialize(sticker.id)),
    },
    Query: {
        myStickers: withActivatedUser(async (ctx, args, id) => {
            return await Modules.Stickers.getUserStickers(ctx, id);
        }),
        stickersByEmoji: withActivatedUser((ctx, args, id) => {
            return Modules.Stickers.findStickers(ctx, id, args.emoji);
        }),
        stickerPack: withActivatedUser(async (ctx, args, id) => {
            let pid = IDs.StickerPack.parse(args.id);

            return await Modules.Stickers.getPack(ctx, id, pid);
        })
    },
    Mutation: {
        stickerPackCreate: withActivatedUser((ctx, args, uid) => {
            return Modules.Stickers.createPack(ctx, uid, args.title);
        }),
        stickerPackUpdate: withActivatedUser((ctx, args) => {
            let id = IDs.StickerPack.parse(args.id);

            return Modules.Stickers.updatePack(ctx, id, args.input);
        }),
        stickerPackAddSticker: withActivatedUser((ctx, args, uid) => {
            let id = IDs.StickerPack.parse(args.id);

            return Modules.Stickers.addSticker(ctx, uid, id, args.input);
        }),
        stickerPackRemoveSticker: withActivatedUser(async (ctx, args, uid) => {
            let id = IDs.Sticker.parse(args.id);

            await Modules.Stickers.removeSticker(ctx, uid, id);
            return true;
        }),

        stickerPackAddToCollection: withActivatedUser(async (ctx, args, uid) => {
            let id = IDs.StickerPack.parse(args.id);

            return await Modules.Stickers.addToCollection(ctx, uid, id);
        }),
        stickerPackRemoveFromCollection: withActivatedUser(async (ctx, args, uid) => {
            let id = IDs.StickerPack.parse(args.id);

            return await Modules.Stickers.removeFromCollection(ctx, uid, id);
        }),
        stickerAddToFavorites: withActivatedUser(async (ctx, args, uid) => {
            let id = IDs.Sticker.parse(args.id);

            return Modules.Stickers.addStickerToFavs(ctx, uid, id);
        }),
        stickerRemoveFromFavorites: withActivatedUser(async (ctx, args, uid) => {
            let id = IDs.Sticker.parse(args.id);

            return Modules.Stickers.removeStickerFromFavs(ctx, uid, id);
        }),
    },
} as GQLResolver;