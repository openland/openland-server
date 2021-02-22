import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { notifyFastWatch } from '../../openland-module-db/fastWatch';
import { lazyInject } from '../../openland-modules/Modules.container';
import { VoiceChatEventsMediator } from '../mediators/VoiceChatEventsMediator';

@injectable()
export class VoiceChatsRepository {
    @lazyInject('VoiceChatEventsMediator')
    private readonly events!: VoiceChatEventsMediator;

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

        await this.notifyChatUpdated(ctx, id);
        return chat;
    }

    setChatActive = async (ctx: Context, id: number, active: boolean) => {
        let chat = await this.#getChatOrFail(ctx, id);
        chat.active = active;
        
        await this.notifyChatUpdated(ctx, id);
        return chat;
    }

    #getChatOrFail = async (ctx: Context, id: number) => {
        let chat = await Store.ConversationVoice.findById(ctx, id);
        if (!chat) {
            throw new NotFoundError();
        }
        return chat;
    }

    notifyChatUpdated = async (ctx: Context, id: number) => {
        await this.events.postChatUpdated(ctx, id);
        notifyFastWatch(ctx, `voice-chat-${id}`);
    }
}
