import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { NotFoundError } from '../../openland-errors/NotFoundError';

@injectable()
export class VoiceChatRepository {
    createChat = async (ctx: Context, title: string) => {
        let id = await fetchNextDBSeq(ctx, 'conversation-id');
        await Store.Conversation.create(ctx, id, { kind: 'voice' });
        return await Store.ConversationVoice.create(ctx, id, {
            active: true,
            listeners: 0,
            speakers: 0,
            title: title
        });
    }

    updateChat = async (ctx: Context, id: number, title: string) => {
        let chat = await this.#getChatOrFail(ctx, id);
        chat.title = title;
    }

    endChat = async (ctx: Context, id: number, title: string) => {
        let chat = await this.#getChatOrFail(ctx, id);
        chat.active = false;
    }

    alterListenersCount = async (ctx: Context, id: number, delta: number)  => {
        let chat = await this.#getChatOrFail(ctx, id);
        chat.listeners = Math.max(0, chat.listeners + delta);
    }

    alterSpeakersCount = async (ctx: Context, id: number, delta: number)  => {
        let chat = await this.#getChatOrFail(ctx, id);
        chat.speakers = Math.max(0, chat.speakers + delta);
    }

    #getChatOrFail = async (ctx: Context, id: number) => {
        let chat = await Store.ConversationVoice.findById(ctx, id);
        if (!chat) {
            throw new NotFoundError();
        }
        return chat;
    }
}