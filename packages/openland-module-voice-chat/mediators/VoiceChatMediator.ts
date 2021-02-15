import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { VoiceChatRepository } from '../repositories/VoiceChatRepository';
import { lazyInject } from 'openland-modules/Modules.container';

@injectable()
export class VoiceChatMediator {
    @lazyInject('VoiceChatRepository')
    private readonly repo!: VoiceChatRepository;

    createChat = async (ctx: Context, title: string) => {
        return this.repo.createChat(ctx, title);
    }

    updateChat = async (ctx: Context, id: number, title: string) => {
        return this.repo.updateChat(ctx, id, title);
    }
}