import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { NotFoundError } from '../../openland-errors/NotFoundError';

@injectable()
export class VoiceChatsRepository {
    createChat = async (ctx: Context, title: string) => {
        let id = await fetchNextDBSeq(ctx, 'conversation-id');
        await Store.Conversation.create(ctx, id, { kind: 'voice' });
        return await Store.ConversationVoice.create(ctx, id, {
            active: true,
            title: title
        });
    }

    updateChat = async (ctx: Context, id: number, title: string) => {
        let chat = await this.#getChatOrFail(ctx, id);
        chat.title = title;
        return chat;
    }

    endChat = async (ctx: Context, id: number) => {
        let chat = await this.#getChatOrFail(ctx, id);
        chat.active = false;
        return chat;
    }

    #getChatOrFail = async (ctx: Context, id: number) => {
        let chat = await Store.ConversationVoice.findById(ctx, id);
        if (!chat) {
            throw new NotFoundError();
        }
        return chat;
    }
}