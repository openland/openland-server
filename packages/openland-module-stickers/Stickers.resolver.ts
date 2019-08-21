import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Modules } from 'openland-modules/Modules';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { IDs } from '../openland-module-api/IDs';

export default {
    Query: {
        myStickers: () => {
            return [];
        },
        stickersByEmoji: () => {
            return [];
        },
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
    },
} as GQLResolver;