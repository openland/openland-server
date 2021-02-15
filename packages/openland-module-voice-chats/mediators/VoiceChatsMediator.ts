import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { VoiceChatsRepository } from '../repositories/VoiceChatsRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { Modules } from '../../openland-modules/Modules';

@injectable()
export class VoiceChatsMediator {
    @lazyInject('VoiceChatsRepository')
    private readonly repo!: VoiceChatsRepository;

    createChat = async (ctx: Context, title: string) => {
        return this.repo.createChat(ctx, title);
    }

    updateChat = async (ctx: Context, by: number, id: number, title: string) => {
        await Modules.VoiceChats.participants.ensureParticipantIsAdmin(ctx, id, by);

        return this.repo.updateChat(ctx, id, title);
    }

    endChat = async (ctx: Context, by: number, id: number) => {
        await Modules.VoiceChats.participants.ensureParticipantIsAdmin(ctx, id, by);

        return this.repo.endChat(ctx, id);
    }
}