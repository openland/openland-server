import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { ImageRef } from '../../openland-module-media/ImageRef';
import { inTx } from '@openland/foundationdb';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { Store } from '../../openland-module-db/FDB';
import { NotFoundError } from '../../openland-errors/NotFoundError';

export interface EditorsChoiceChatInput {
    image: ImageRef;
    cid: number;
}

@injectable()
export class EditorsChoiceChatsRepository {
    async createChat(parent: Context, creatorId: number, input: EditorsChoiceChatInput) {
        return await inTx(parent, async ctx => {
            let conv = await Store.ConversationRoom.findById(ctx, input.cid);
            if (!conv || !conv.listed) {
                throw new NotFoundError();
            }
            let id = await fetchNextDBSeq(ctx, 'editors-choice-chat');
            let chat = await Store.EditorsChoiceChat.create(ctx, id, {
                image: input.image,
                cid: input.cid,
                createdBy: creatorId,
                deleted: false
            });
            await chat.flush(ctx);
            return chat;
        });
    }

    async updateChat(parent: Context, id: number, input: Partial<EditorsChoiceChatInput>) {
        return await inTx(parent, async ctx => {
            let chat = await Store.EditorsChoiceChat.findById(ctx, id);
            if (!chat || chat.deleted) {
                throw new NotFoundError();
            }

            if (input.image) {
                chat.image = input.image;
            }
            if (input.cid) {
                chat.cid = input.cid;
            }

            await chat.flush(ctx);
            return chat;
        });
    }

    async deleteChat(parent: Context, id: number) {
        return await inTx(parent, async ctx => {
            let chat = await Store.EditorsChoiceChat.findById(ctx, id);
            if (!chat || chat.deleted) {
                throw new NotFoundError();
            }

            chat.deleted = true;
            await chat.flush(ctx);
            return chat;
        });
    }
}
