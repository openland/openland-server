import { injectable } from 'inversify';
import { StickerInput, StickerPackInput, StickersRepository } from '../repositories/StickersRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from '@openland/context';

@injectable()
export class StickersMediator {
    @lazyInject('StickersRepository')
    private readonly repo!: StickersRepository;

    createPack = (parent: Context, uid: number, title: string) => {
        return this.repo.createPack(parent, uid, title);
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

    getPacksBy = (parent: Context, uid: number) => {
        return this.repo.getPacksBy(parent, uid);
    }

    getPack = async (parent: Context, uid: number, pid: number) => {
        return this.repo.getPack(parent, uid, pid);
    }

    getCatalog = async (parent: Context) => {
        return this.repo.getCatalog(parent);
    }
}