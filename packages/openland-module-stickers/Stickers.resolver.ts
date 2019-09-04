import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { IDs } from '../openland-module-api/IDs';
import { AppContext } from '../openland-modules/AppContext';
import { MaybePromise } from '../openland-module-api/schema/SchemaUtils';
import { Sticker, StickerPack } from 'openland-module-db/store';
import { Store } from 'openland-module-db/FDB';

type StickerPackRoot = StickerPack | number;
type StickerRoot = Sticker | string;

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
    Query: {
        myStickers: withActivatedUser(async (ctx, args, id) => {
            return await Modules.Stickers.getUserStickers(ctx, id);
        }),
        stickersByEmoji: withActivatedUser((ctx, args) => {
            return Modules.Stickers.findStickers(ctx, args.emoji);
        }),
        stickerPack: withActivatedUser(async (ctx, args, id) => {
            let pid = IDs.StickerPack.parse(args.id);

            return await Modules.Stickers.getPack(ctx, pid);
        })
    },
    StickerPack: {
        id: withStickerPackId((ctx, id) => IDs.StickerPack.serialize(id)),
        author: withStickerPack(async (ctx, pack) => pack.authorId),
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
    Sticker: {
        image: withSticker((ctx, sticker) => sticker.image),
        animated: withSticker((ctx, sticker) => sticker.animated),
        emoji: withSticker((ctx, sticker) => sticker.emoji),
        pack: withSticker((ctx, sticker) => sticker.packId),
        uuid: withSticker((ctx, sticker) => sticker.uuid),
    },
    Mutation: {
        stickerPackCreate: withActivatedUser((ctx, args, uid) => {
            return Modules.Stickers.createPack(ctx, uid, args.title);
        }),
        stickerPackUpdate: withActivatedUser((ctx, args) => {
            let id = IDs.StickerPack.parse(args.id);

            return Modules.Stickers.updatePack(ctx, id, args.input);
        }),
        stickerPackAddSticker: withActivatedUser((ctx, args) => {
            let id = IDs.StickerPack.parse(args.id);

            return Modules.Stickers.addSticker(ctx, id, args.input);
        }),
        stickerPackRemoveSticker: withActivatedUser(async (ctx, args) => {
            await Modules.Stickers.removeSticker(ctx, args.uuid);
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
        stickerAddToFavorites: withActivatedUser(async (ctx, args) => {
            return Modules.Stickers.addStickerToFavs(ctx, args.id);
        }),
        stickerRemoveFromFavorites: withActivatedUser(async (ctx, args) => {
            return Modules.Stickers.removeStickerFromFavs(ctx, args.id);
        }),
    },
} as GQLResolver;