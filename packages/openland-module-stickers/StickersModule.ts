import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from '@openland/context';
import { StickersMediator } from './mediators/StickersMediator';
import { StickerPackInput, StickerInput } from './repositories/StickersRepository';
import { UserStickersMediator } from './mediators/UserStickersMediator';

@injectable()
export class StickersModule {
    @lazyInject('StickersMediator')
    private readonly mediator!: StickersMediator;
    @lazyInject('UserStickersMediator')
    private readonly userStickers!: UserStickersMediator;

    start = () => {
        //
    }

    createPack = async (parent: Context, uid: number, title: string, stickers?: StickerInput[] | null) => {
        let pack = await this.mediator.createPack(parent, uid, title);
        if (stickers) {
            await Promise.all(stickers.map(a => this.mediator.addSticker(parent, uid, pack.id, a)));

        }
        return pack;
    }

    updatePack = (parent: Context, id: number, input: StickerPackInput) => {
        return this.mediator.updatePack(parent, id, input);
    }

    addSticker = (parent: Context, uid: number, pid: number, input: StickerInput) => {
        return this.mediator.addSticker(parent, uid, pid, input);
    }

    removeSticker = (parent: Context, uid: number, uuid: string) => {
        return this.mediator.removeSticker(parent, uid, uuid);
    }

    addToCollection = (parent: Context, uid: number, pid: number, isUnviewed?: boolean, skipAccessChecks?: boolean) => {
        return this.userStickers.addToCollection(parent, uid, pid, isUnviewed, skipAccessChecks);
    }

    removeFromCollection = (parent: Context, uid: number, pid: number) => {
        return this.userStickers.removeFromCollection(parent, uid, pid);
    }

    findStickers = async (parent: Context, uid: number, emoji: string) => {
        return this.userStickers.findStickers(parent, uid, emoji);
    }

    getPack = async (parent: Context, uid: number, pid: number) => {
        return this.mediator.getPack(parent, uid, pid);
    }

    addStickerToFavs = async (parent: Context, uid: number, id: string) => {
        return this.userStickers.addStickerToFavs(parent, uid, id);
    }

    removeStickerFromFavs = async (parent: Context, uid: number, id: string) => {
        return this.userStickers.removeStickerFromFavs(parent, uid, id);
    }

    getPacksBy = async (parent: Context, uid: number) => {
        return this.mediator.getPacksBy(parent, uid);
    }

    getUserStickers = (parent: Context, uid: number) => {
        return this.userStickers.getUserStickers(parent, uid);
    }

    markUserStickersAsViewed = (parent: Context, uid: number) => {
        return this.userStickers.markUserStickersAsViewed(parent, uid);
    }

    getUserStickersState = (parent: Context, uid: number) => {
        return this.userStickers.getUserStickersState(parent, uid);
    }

    getCatalog = (parent: Context) => {
        return this.mediator.getCatalog(parent);
    }
}