import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { ImageRef } from '../../openland-module-media/ImageRef';
import { inTx } from '@openland/foundationdb';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { Store } from '../../openland-module-db/FDB';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { UserError } from '../../openland-errors/UserError';

export interface ChatCollectionInput {
    title: string;
    description?: string | null;
    image: ImageRef;
    chatIds: number[];
}

@injectable()
export class ChatCollectionsRepository {
    async createCollection(parent: Context, creatorId: number, input: ChatCollectionInput) {
        return await inTx(parent, async ctx => {
            // Check input
            await this.checkChats(parent, input.chatIds);

            let id = await fetchNextDBSeq(ctx, 'editors-choice-chats-collection');
            let collection = await Store.EditorsChoiceChatsCollection.create(ctx, id, {
                title: input.title,
                image: input.image,
                chatIds: input.chatIds,
                createdBy: creatorId,
                description: input.description,
                deleted: false
            });
            await collection.flush(ctx);
            return collection;
        });
    }

    async updateCollection(parent: Context, collectionId: number, input: Partial<ChatCollectionInput>) {
        return await inTx(parent, async ctx => {
            let collection = await Store.EditorsChoiceChatsCollection.findById(ctx, collectionId);
            if (!collection || collection.deleted) {
                throw new NotFoundError();
            }

            if (input.title) {
                collection.title = input.title;
            }
            if (input.image) {
                collection.image = input.image;
            }
            if (input.chatIds) {
                collection.chatIds = input.chatIds;
            }
            if (input.description !== null && input.description !== undefined) {
                collection.description = input.description;
            }

            await collection.flush(ctx);
            return collection;
        });
    }

    async deleteCollection(parent: Context, collectionId: number) {
        return await inTx(parent, async ctx => {
            let collection = await Store.EditorsChoiceChatsCollection.findById(ctx, collectionId);
            if (!collection || collection.deleted) {
                throw new NotFoundError();
            }

            collection.deleted = true;
            await collection.flush(ctx);
            return collection;
        });
    }

    private async checkChats(parent: Context, chats: number[]) {
        return await inTx(parent, async ctx => {
            for (let cid of chats) {
                let room = await Store.ConversationRoom.findById(ctx, cid);
                if (!room) {
                    throw new NotFoundError();
                }
                if (room.kind !== 'public') {
                    throw new UserError('Only public chats can be in collection');
                }
            }
        });
    }
}
