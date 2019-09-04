import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { StickersRepository } from './repositories/StickersRepository';
import { Context } from '@openland/context';
import { GQL } from '../openland-module-api/schema/SchemaSpec';
import StickerPackInput = GQL.StickerPackInput;
import StickerInput = GQL.StickerInput;
import { Store } from '../openland-module-db/FDB';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { inTx } from '@openland/foundationdb';

@injectable()
export class StickersModule {
    @lazyInject('StickersRepository') private readonly repo!: StickersRepository;

    start = () => {
        //
    }

    createPack = (parent: Context, uid: number, title: string) => {
        return this.repo.createPack(parent, uid, title);
    }

    updatePack = (parent: Context, id: number, input: StickerPackInput) => {
        return this.repo.updatePack(parent, id, input);
    }

    addSticker = (parent: Context, pid: number, input: StickerInput) => {
        return this.repo.addSticker(parent, pid, input);
    }

    removeSticker = (parent: Context, uuid: string) => {
        return this.repo.removeSticker(parent, uuid);
    }

    addToCollection = (parent: Context, uid: number, pid: number) => {
        return this.repo.addToCollection(parent, uid, pid);
    }

    removeFromCollection = (parent: Context, uid: number, pid: number) => {
        return this.repo.removeFromCollection(parent, uid, pid);
    }

    findStickers = async (parent: Context, emoji: string) => {
        let auth = AuthContext.get(parent);

        let userStickers = await this.getUserStickers(parent, auth.uid!);
        let stickers: string[] = [];
        for (let id of userStickers.packIds) {
            let pack = await Store.StickerPack.findById(parent, id);
            stickers = stickers.concat(pack!.emojis.filter(a => a.emoji === emoji).map(a => a.stickerId));
        }

        return stickers;
    }

    getPack = async (parent: Context, pid: number) => {
        let user = AuthContext.get(parent);
        let pack = await Store.StickerPack.findById(parent, pid);

        if (!pack || (user.uid !== pack.authorId && !pack.published)) {
            return null;
        }

        return pack;
    }

    addStickerToFavs = async (parent: Context, uuid: string) => {
        let user = AuthContext.get(parent);

        return await inTx(parent, async ctx => {
            let userStickers = await this.getUserStickers(ctx, user.uid!);
            if (userStickers.favouriteIds.find(a => a === uuid)) {
                return false;
            }
            userStickers.favouriteIds = [...userStickers.favouriteIds, uuid];

            await userStickers.flush(ctx);
            return true;
        });
    }

    removeStickerFromFavs = async (parent: Context, uuid: string) => {
        let user = AuthContext.get(parent);

        return await inTx(parent, async ctx => {
            let userStickers = await this.getUserStickers(ctx, user.uid!);
            if (userStickers.favouriteIds.every(a => a !== uuid)) {
                return false;
            }
            userStickers.favouriteIds = [...userStickers.favouriteIds.filter(a => a !== uuid)];

            await userStickers.flush(ctx);
            return true;
        });
    }

    getUserStickers = (parent: Context, uid: number) => {
        return this.repo.getUserStickers(parent, uid);
    }
}