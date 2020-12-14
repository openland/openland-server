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
import { Config } from 'openland-config/Config';

export interface StickerPackInput {
    title: string | null;
    published: boolean | null;
    stickers: string[] | null;
    private: boolean | null;
    listed: boolean | null;
}

export interface StickerInput {
    image: ImageRef;
    emoji: string;
}

const isProd = Config.environment === 'production';
export const DEFAULT_PACK_IDS = [21, 22, 23, 24, 25];

@injectable()
export class StickersRepository {
    createPack = (parent: Context, uid: number, title: string) => {
        return inTx(parent, async (ctx) => {
            if (title.trim().length === 0) {
                throw new UserError('Title mustn\'t be empty');
            }

            return await Store.StickerPack.create(ctx, await fetchNextDBSeq(ctx, 'sticker-pack-id'), {
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
            if (input.stickers) {
                if (input.stickers.length !== stickers.length) {
                    throw new UserError('Expected stickers length to be equal with exact stickers length');
                }
                for (let sticker of stickers) {
                    sticker.order = input.stickers.indexOf(sticker.id);
                }
            }
            if (input.private !== null) {
                pack.private = input.private;
            }
            if (input.listed !== null) {
                pack.listed = input.listed;
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

            let imageRef = Sanitizer.sanitizeImageRef(input.image);
            if (imageRef) {
                await Modules.Media.saveFile(ctx, imageRef.uuid);
            }

            let id = Store.storage.db.get(RandomLayer).nextRandomId();
            let sticker = await Store.Sticker.create(ctx, id, {
                emoji: input.emoji,
                relatedEmojis: [input.emoji],
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

    getPacksBy = (parent: Context, uid: number) => {
        return Store.StickerPack.author.findAll(parent, uid);
    }

    getPack = async (parent: Context, uid: number, pid: number) => {
        let pack = await Store.StickerPack.findById(parent, pid);

        if (!pack || (uid !== pack.uid && !pack.published)) {
            return null;
        }

        return pack;
    }

    getCatalog = async (parent: Context) => {
        if (isProd) {
            return DEFAULT_PACK_IDS;
        }
        return [];
    }
}
