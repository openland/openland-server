import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { UserError } from '../../openland-errors/UserError';
import { Store } from '../../openland-module-db/FDB';
import { GQL } from '../../openland-module-api/schema/SchemaSpec';
import StickerPackInput = GQL.StickerPackInput;
import StickerInput = GQL.StickerInput;
import { Modules } from '../../openland-modules/Modules';
import { AuthContext } from '../../openland-module-auth/AuthContext';

@injectable()
export class StickersRepository {
    createPack = (parent: Context, uid: number, title: string) => {
        return inTx(parent, async (ctx) => {
            if (title.trim().length === 0) {
                throw new UserError('Title mustn\'t be empty');
            }
            let id = await this.fetchNextPackId(ctx);

            return await Store.StickerPack.create(ctx, id, {
                authorId: uid,
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

    addSticker = (parent: Context, pid: number, input: StickerInput) => {
        return inTx(parent, async (ctx) => {
            let pack = await Store.StickerPack.findById(ctx, pid);
            if (!pack) {
                throw new Error('Invalid pack id');
            }

            let authId = AuthContext.get(ctx).uid;
            if (pack.authorId !== authId) {
                throw new Error('Cannot add sticker to foreign sticker pack');
            }

            let fileInfo = await Modules.Media.fetchFileInfo(parent, input.image.uuid);

            let sticker = await Store.Sticker.create(ctx, input.image.uuid, {
                emoji: input.emoji,
                packId: pid,
                animated: fileInfo.imageFormat === 'GIF',
                deleted: false
            });

            pack.emojis.push({
                emoji: sticker.emoji,
                stickerId: sticker.uuid,
            });
            await pack.flush(ctx);
            return sticker;
        });
    }

    removeSticker = (parent: Context, uuid: string) => {
        return inTx(parent, async (ctx) => {
            let sticker = await Store.Sticker.findById(ctx, uuid);
            if (!sticker) {
                throw new Error('Invalid sticker');
            }
            let pack = await Store.StickerPack.findById(ctx, sticker.packId);
            if (!pack) {
                throw new Error('Consistency error');
            }

            let authId = AuthContext.get(ctx).uid;
            if (pack.authorId !== authId) {
                throw new Error('Cannot remove sticker from foreign sticker pack');
            }

            sticker.deleted = true;
            pack.emojis = pack.emojis.filter((e) => e.stickerId !== uuid);
            if (pack.emojis.length === 0) {
                pack.published = false;
            }

            await pack.flush(ctx);
            await sticker.flush(ctx);
        });
    }

    private fetchNextPackId = async (ctx: Context) => {
        let seq = (await Store.Sequence.findById(ctx, 'sticker-pack-id'));
        if (!seq) {
            seq = await Store.Sequence.create(ctx, 'sticker-pack-id', { value: 0 });
        }
        return ++seq.value;
    }
}