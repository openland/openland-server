import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { StickersRepository } from './repositories/StickersRepository';
import { Context } from '@openland/context';
import { GQL } from '../openland-module-api/schema/SchemaSpec';
import StickerPackInput = GQL.StickerPackInput;
import StickerInput = GQL.StickerInput;

@injectable()
export class StickersModule {
    @lazyInject('StickersRepository') private readonly repo!: StickersRepository;

    start = () => {
        //
    }

    createPack = async (parent: Context, uid: number, title: string, stickers?: StickerInput[] | null) => {
        let pack = await this.repo.createPack(parent, uid, title);
        if (stickers) {
            await Promise.all(stickers.map(a => this.repo.addSticker(parent, uid, pack.id, a)));

        }
        return pack;
    }

    updatePack = (parent: Context, id: number, input: StickerPackInput) => {
        return this.repo.updatePack(parent, id, input);
    }

    addSticker = (parent: Context, uid: number, pid: number, input: StickerInput) => {
        return this.repo.addSticker(parent, uid, pid, input);
    }

    removeSticker = (parent: Context, uid: number, uuid: string) => {
        return this.repo.removeSticker(parent, uid, uuid);
    }

    addToCollection = (parent: Context, uid: number, pid: number) => {
        return this.repo.addToCollection(parent, uid, pid);
    }

    removeFromCollection = (parent: Context, uid: number, pid: number) => {
        return this.repo.removeFromCollection(parent, uid, pid);
    }

    findStickers = async (parent: Context, uid: number, emoji: string) => {
        return this.repo.findStickers(parent, uid, emoji);
    }

    getPack = async (parent: Context, uid: number, pid: number) => {
        return this.repo.getPack(parent, uid, pid);
    }

    addStickerToFavs = async (parent: Context, uid: number, id: string) => {
        return this.repo.addStickerToFavs(parent, uid, id);
    }

    removeStickerFromFavs = async (parent: Context, uid: number, id: string) => {
        return this.repo.removeStickerFromFavs(parent, uid, id);
    }

    getPacksBy = async (parent: Context, uid: number) => {
        return this.repo.getPacksBy(parent, uid);
    }

    getUserStickers = (parent: Context, uid: number) => {
        return this.repo.getUserStickers(parent, uid);
    }

    getUserStickersState = (parent: Context, uid: number) => {
        return this.repo.getUserStickersState(parent, uid);
    }

    getCatalog = (parent: Context) => {
        return this.repo.getCatalog(parent);
    }
}