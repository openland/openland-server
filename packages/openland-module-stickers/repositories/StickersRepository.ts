import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { UserError } from '../../openland-errors/UserError';
import { Store } from '../../openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';
import { Sanitizer } from '../../openland-utils/Sanitizer';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { ImageRef } from '../../openland-module-media/ImageRef';
import { RandomLayer } from '@openland/foundationdb-random';

export interface StickerPackInput {
    title: string | null;
    published: boolean | null;
}

export interface StickerInput {
    image: ImageRef;
    emoji: string;
}

@injectable()
export class StickersRepository {
    createPack = (parent: Context, uid: number, title: string) => {
        return inTx(parent, async (ctx) => {
            if (title.trim().length === 0) {
                throw new UserError('Title mustn\'t be empty');
            }
            let id = await this.fetchNextPackId(ctx);

            return await Store.StickerPack.create(ctx, id, {
                uid,
                emojis: [],
                published: false,
                title: title,
                usesCount: 0
            });
        });
    }

    updatePack = (parent: Context, id: number, input: StickerPackInput) => {
        return inTx(parent, async (ctx) => {
            let pack = await Store.StickerPack.findById(ctx, id);
            if (!pack) {
                throw new Error('Invalid sticker pack id');
            }

            let stickers = await Store.Sticker.packActive.findAll(ctx, id);
            if (input.published !== null && input.published !== undefined) {
                if (stickers.length === 0) {
                    throw new UserError('Empty sticker pack cannot be published');
                }
                pack.published = input.published;
            }
            if (input.title) {
                if (input.title.trim().length === 0) {
                    throw new UserError('Title mustn\'t be empty');
                }
                pack.title = input.title.trim();
            }
            await pack.flush(ctx);

            return pack;
        });
    }

    addSticker = (parent: Context, uid: number, pid: number, input: StickerInput) => {
        return inTx(parent, async (ctx) => {
            let pack = await Store.StickerPack.findById(ctx, pid);
            if (!pack) {
                throw new Error('Invalid pack id');
            }

            if (pack.uid !== uid) {
                throw new Error('Cannot add sticker to foreign sticker pack');
            }

            let imageRef = await Sanitizer.sanitizeImageRef(input.image);
            if (imageRef) {
                await Modules.Media.saveFile(ctx, imageRef.uuid);
            }

            let id = Store.storage.db.get(RandomLayer).nextRandomId();
            let sticker = await Store.Sticker.create(ctx, id, {
                emoji: input.emoji,
                packId: pid,
                image: imageRef!,
                deleted: false
            });

            pack.emojis = [...pack.emojis, {
                emoji: sticker.emoji,
                stickerId: sticker.id,
            }];
            await pack.flush(ctx);
            return sticker;
        });
    }

    removeSticker = (parent: Context, uid: number, uuid: string) => {
        return inTx(parent, async (ctx) => {
            let sticker = await Store.Sticker.findById(ctx, uuid);
            if (!sticker) {
                throw new Error('Invalid sticker');
            }
            let pack = await Store.StickerPack.findById(ctx, sticker.packId);
            if (!pack) {
                throw new Error('Consistency error');
            }

            if (pack.uid !== uid) {
                throw new AccessDeniedError();
            }

            sticker.deleted = true;
            pack.emojis = [...pack.emojis.filter((e) => e.stickerId !== uuid)];
            if (pack.emojis.length === 0) {
                pack.published = false;
            }

            await pack.flush(ctx);
            await sticker.flush(ctx);
        });
    }

    addToCollection = (parent: Context, uid: number, pid: number) => {
        return inTx(parent, async (ctx) => {
            let pack = await Store.StickerPack.findById(ctx, pid);
            if (!pack) {
                throw new Error('invalid pack');
            }

            let userStickersState = await this.getUserStickersState(ctx, uid);
            if (userStickersState.packIds.find(a => a === pid)) {
                return false;
            }
            userStickersState.packIds = [...userStickersState.packIds, pid];
            await userStickersState.flush(ctx);

            pack.usesCount++;
            await pack.flush(ctx);

            return true;
        });
    }

    removeFromCollection = (parent: Context, uid: number, pid: number) => {
        return inTx(parent, async (ctx) => {
            let pack = await Store.StickerPack.findById(ctx, pid);
            if (!pack) {
                throw new Error('invalid pack');
            }

            let userStickersState = await this.getUserStickersState(ctx, uid);
            if (!userStickersState.packIds.find(a => a === pid)) {
                return false;
            }

            userStickersState.packIds = [...userStickersState.packIds.filter(a => a !== pid)];
            await userStickersState.flush(ctx);

            pack.usesCount--;
            await pack.flush(ctx);

            return true;
        });
    }

    getUserStickers = (parent: Context, uid: number) => {
        return inTx(parent, (ctx) => {
            return this.getUserStickersState(ctx, uid);
        });
    }

    findStickers = async (parent: Context, uid: number, emoji: string) => {
        let userStickers = await this.getUserStickers(parent, uid);
        let stickers: string[] = [];
        for (let id of userStickers.packIds) {
            let pack = await Store.StickerPack.findById(parent, id);
            stickers = stickers.concat(pack!.emojis.filter(a => a.emoji === emoji).map(a => a.stickerId));
        }

        return stickers;
    }

    getPack = async (parent: Context, uid: number, pid: number) => {
        let pack = await Store.StickerPack.findById(parent, pid);

        if (!pack || (uid !== pack.uid && !pack.published)) {
            return null;
        }

        return pack;
    }

    addStickerToFavs = async (parent: Context, uid: number, uuid: string) => {
        return await inTx(parent, async ctx => {
            let userStickers = await this.getUserStickers(ctx, uid);
            if (userStickers.favouriteIds.find(a => a === uuid)) {
                return false;
            }
            userStickers.favouriteIds = [...userStickers.favouriteIds, uuid];

            await userStickers.flush(ctx);
            return true;
        });
    }

    removeStickerFromFavs = async (parent: Context, uid: number, uuid: string) => {
        return await inTx(parent, async ctx => {
            let userStickers = await this.getUserStickers(ctx, uid);
            if (userStickers.favouriteIds.every(a => a !== uuid)) {
                return false;
            }
            userStickers.favouriteIds = [...userStickers.favouriteIds.filter(a => a !== uuid)];

            await userStickers.flush(ctx);
            return true;
        });
    }

    private getUserStickersState = async (parent: Context, uid: number) => {
        return inTx(parent,  async ctx => {
            let state = await Store.UserStickersState.findById(ctx, uid);
            if (!state) {
                state = await Store.UserStickersState.create(ctx, uid, {
                    favouriteIds: [], packIds: [],
                });
            }
            return state;
        });
    }

    private fetchNextPackId = async (ctx: Context) => await fetchNextDBSeq(ctx, 'sticker-pack-id');
}