import { injectable } from 'inversify';
import { Context, createNamedContext } from '@openland/context';
import { VoiceChatsRepository } from '../repositories/VoiceChatsRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { Modules } from '../../openland-modules/Modules';
import { VoiceChatReportsMediator } from './VoiceChatReportsMediator';
import { inTx } from '@openland/foundationdb';
import { Events } from 'openland-module-hyperlog/Events';
import { Store } from '../../openland-module-db/FDB';

@injectable()
export class VoiceChatsMediator {
    @lazyInject('VoiceChatsRepository')
    private readonly repo!: VoiceChatsRepository;

    @lazyInject('VoiceChatReportsMediator')
    private readonly reports!: VoiceChatReportsMediator;

    start() {
        this.#enableVoiceChatReports();
        this.#enableVoiceChatAnalytics();
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

    //
    // Voice chat events
    //
    #enableVoiceChatReports = () => {
        this.repo.voiceChatActiveChanged.subscribe(async ({ cid, active }) => {
            await inTx(createNamedContext('voice-chat-reports'), async (ctx) => {
                await this.reports.sendChatActiveChangedReport(ctx, cid, active);
            });
        });
    }

    #enableVoiceChatAnalytics = () => {
        this.repo.voiceChatActiveChanged.subscribe(async ({ cid, active }) => {
            if (active) {
                return;
            }

            await inTx(createNamedContext('voice-chat-analytics'), async (ctx) => {
                let chat = await Store.ConversationVoice.findById(ctx, cid);
                if (!chat?.duration) {
                    return;
                }

                let attendance = (await Store.VoiceChatParticipant.chatAll.findAll(ctx, cid)).length;
                await Events.VoiceChatEndedEvent.event(ctx, {
                    cid: cid,
                    attendance: attendance,
                    duration: chat.duration,
                });
            });
        });
    }
}