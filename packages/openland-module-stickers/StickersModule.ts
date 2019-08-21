import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { StickersRepository } from './repositories/StickersRepository';
import { Context } from '@openland/context';
import { GQL } from '../openland-module-api/schema/SchemaSpec';
import StickerPackInput = GQL.StickerPackInput;
import StickerInput = GQL.StickerInput;
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';

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
        return inTx(parent, async (ctx) => {
            let pack = await Store.StickerPack.findById(ctx, pid);
            if (!pack) {
                throw new Error('invalid pack');
            }

            let userStickersState = await this.getUserStickersState(ctx, uid);
            userStickersState.packIds.push(pid);
            await userStickersState.flush(ctx);

            return true;
        });
    }

    private getUserStickersState = async (ctx: Context, uid: number) => {
        let state = await Store.UserStickersState.findById(ctx, uid);
        if (!state) {
            state = await Store.UserStickersState.create(ctx, uid, {
                favouriteIds: [], packIds: [],
            });
        }
        return state;
    }
}