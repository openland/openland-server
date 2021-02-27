import { injectable } from 'inversify';
import { Context, createNamedContext } from '@openland/context';
import { VoiceChatsRepository } from '../repositories/VoiceChatsRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { Modules } from '../../openland-modules/Modules';
import { VoiceChatReportsMediator } from './VoiceChatReportsMediator';
import { inTx } from '@openland/foundationdb';

@injectable()
export class VoiceChatsMediator {
    @lazyInject('VoiceChatsRepository')
    private readonly repo!: VoiceChatsRepository;

    @lazyInject('VoiceChatReportsMediator')
    private readonly reports!: VoiceChatReportsMediator;

    start() {
        // Setup voice chat reports
        this.repo.voiceChatActiveChanged.subscribe(async ({ cid, active }) => {
            await inTx(createNamedContext('voice-chat-reports'), async (ctx) => {
                await this.reports.sendChatActiveChangedReport(ctx, cid, active);
            });
        });
    }

    createChat = async (ctx: Context, title: string, startedBy?: number) => {
        return this.repo.createChat(ctx, title, startedBy);
    }

    updateChat = async (ctx: Context, by: number, id: number, title: string) => {
        await Modules.VoiceChats.participants.ensureParticipantIsAdmin(ctx, id, by);

        return this.repo.updateChat(ctx, id, title);
    }

    endChat = async (ctx: Context, by: number, id: number) => {
        await Modules.VoiceChats.participants.ensureParticipantIsAdmin(ctx, id, by);

        return this.repo.setChatActive(ctx, id, false);
    }
}