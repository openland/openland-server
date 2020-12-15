import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { isDefined } from '../../openland-utils/misc';
import { Config } from '../../openland-config/Config';
import { DEFAULT_PACK_IDS } from './StickersRepository';
import { injectable } from 'inversify';
import { UserStickersUpdateEvent } from '../../openland-module-db/store';

const isProd = Config.environment === 'production';

@injectable()
export class UserStickersRepository {
    /*
     * Queries
     */
    getUserStickers = (parent: Context, uid: number) => {
        return inTx(parent, async (ctx) => {
            let state = await this.getUserStickersState(ctx, uid);
            let packs = await Promise.all(state.packIds.map(a => Store.StickerPack.findById(ctx, a)));

            return {
                packs: packs.filter(isDefined).filter(a => a.published),
                favoriteIds: state.favoriteIds,
                unviewedPackIds: state.unviewedPackIds || []
            };
        });
    }

    findStickers = async (parent: Context, uid: number, emoji: string) => {
        let userStickers = await this.getUserStickers(parent, uid);
        let stickers: string[] = [];

        for (let pack of userStickers.packs) {
            if (!pack!.published) {
                continue;
            }
            stickers = stickers.concat(pack!.emojis.filter(a => a.emoji === emoji).map(a => a.stickerId));
        }

        return stickers;
    }

    getUserStickersState = async (parent: Context, uid: number) => {
        return inTx(parent,  async ctx => {
            let state = await Store.UserStickersState.findById(ctx, uid);
            if (!state) {
                let packIds: number[] = [];
                if (isProd) {
                    packIds = DEFAULT_PACK_IDS;
                }
                state = await Store.UserStickersState.create(ctx, uid, {
                    favoriteIds: [], packIds,
                });
            }
            return state;
        });
    }

    /*
     * Mutations
     */
    addToCollection = async (ctx: Context, uid: number, pid: number, isUnviewed?: boolean) => {
        let pack = await Store.StickerPack.findById(ctx, pid);
        let wasAddedPreviously = Store.StickerPackWasAdded.byId(uid, pid);
        if (!pack) {
            throw new Error('invalid pack');
        }

        // if (isUnviewed && await wasAddedPreviously.get(ctx)) {
        //     return false;
        // }

        let userStickersState = await this.getUserStickersState(ctx, uid);
        if (userStickersState.packIds.find(a => a === pid)) {
            return false;
        }
        userStickersState.packIds = [pid, ...userStickersState.packIds];
        if (pack.private) {
            if (!userStickersState.privatePackIds) {
                userStickersState.privatePackIds = [];
            }

            userStickersState.privatePackIds = [pid, ...userStickersState.privatePackIds];
        }
        if (isUnviewed) {
            if (userStickersState.unviewedPackIds === undefined || userStickersState.unviewedPackIds === null) {
                userStickersState.unviewedPackIds = [];
            }

            if (!userStickersState.unviewedPackIds.find(a => a === pid)) {
                userStickersState.unviewedPackIds = [pid, ...userStickersState.unviewedPackIds];
            }
        }

        wasAddedPreviously.set(ctx, true);
        await userStickersState.flush(ctx);

        pack.usesCount++;
        await pack.flush(ctx);

        return true;
    }

    removeFromCollection = async (ctx: Context, uid: number, pid: number) => {
        let pack = await Store.StickerPack.findById(ctx, pid);
        if (!pack) {
            throw new Error('invalid pack');
        }

        let userStickersState = await this.getUserStickersState(ctx, uid);
        if (!userStickersState.packIds.find(a => a === pid)) {
            return false;
        }
        if (userStickersState.unviewedPackIds?.find(a => a === pid)) {
            userStickersState.unviewedPackIds = [...userStickersState.unviewedPackIds.filter(a => a !== pid)];
        }

        userStickersState.packIds = [...userStickersState.packIds.filter(a => a !== pid)];
        await userStickersState.flush(ctx);

        pack.usesCount--;
        await pack.flush(ctx);

        return true;
    }

    addStickerToFavs = async (ctx: Context, uid: number, uuid: string) => {
        let userStickers = await this.getUserStickersState(ctx, uid);
        if (userStickers.favoriteIds.find(a => a === uuid)) {
            return false;
        }
        userStickers.favoriteIds = [uuid, ...userStickers.favoriteIds];

        await userStickers.flush(ctx);
        return true;
    }

    removeStickerFromFavs = async (ctx: Context, uid: number, uuid: string) => {
        let userStickers = await this.getUserStickersState(ctx, uid);
        if (userStickers.favoriteIds.every(a => a !== uuid)) {
            return false;
        }
        userStickers.favoriteIds = [...userStickers.favoriteIds.filter(a => a !== uuid)];

        await userStickers.flush(ctx);
        return true;
    }

    markUserStickersAsViewed = async (ctx: Context, uid: number) => {
        let state = await this.getUserStickersState(ctx, uid);
        state.unviewedPackIds = [];
    }

    /*
     * Events
     */
    postStickersUpdateEvent = (ctx: Context, uid: number) => {
        Store.UserStickersEventStore.post(ctx, uid, UserStickersUpdateEvent.create({
            uid: uid,
        }));
    }
}