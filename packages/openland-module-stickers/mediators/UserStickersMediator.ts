import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from '@openland/context';
import { UserStickersRepository } from '../repositories/UserStickersRepostory';
import { Store } from '../../openland-module-db/FDB';
import { UserError } from '../../openland-errors/UserError';

@injectable()
export class UserStickersMediator {
    @lazyInject('UserStickersRepository')
    private readonly repo!: UserStickersRepository;

    addToCollection = async (ctx: Context, uid: number, pid: number, isUnviewed?: boolean, skipAccessChecks?: boolean) => {
        let pack = await Store.StickerPack.findById(ctx, pid);

        if (pack?.private && !skipAccessChecks) {
            let userStickers = await this.repo.getUserStickersState(ctx, uid);
            if (!userStickers.privatePackIds?.includes(pid)) {
                throw new UserError('Cannot add private sticker pack');
            }
        }

        let res = this.repo.addToCollection(ctx, uid, pid, isUnviewed);
        if (res) {
            await this.repo.postStickersUpdateEvent(ctx, uid);
        }
        return res;
    }

    removeFromCollection = async (parent: Context, uid: number, pid: number) => {
        let res = this.repo.removeFromCollection(parent, uid, pid);
        if (res) {
            this.repo.postStickersUpdateEvent(parent, uid);
        }
        return res;
    }

    getUserStickers = (parent: Context, uid: number) => {
        return this.repo.getUserStickers(parent, uid);
    }

    markUserStickersAsViewed = (parent: Context, uid: number) => {
        return this.repo.markUserStickersAsViewed(parent, uid);
    }

    findStickers = async (parent: Context, uid: number, emoji: string) => {
        return this.repo.findStickers(parent, uid, emoji);
    }

    addStickerToFavs = async (parent: Context, uid: number, uuid: string) => {
        let res = this.repo.addStickerToFavs(parent, uid, uuid);
        if (res) {
            this.repo.postStickersUpdateEvent(parent, uid);
        }
        return res;
    }

    removeStickerFromFavs = async (parent: Context, uid: number, uuid: string) => {
        let res = this.repo.removeStickerFromFavs(parent, uid, uuid);
        if (res) {
            this.repo.postStickersUpdateEvent(parent, uid);
        }
        return res;
    }

    getUserStickersState = async (parent: Context, uid: number) => {
        return this.repo.getUserStickersState(parent, uid);
    }
}