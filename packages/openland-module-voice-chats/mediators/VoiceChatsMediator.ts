import { injectable } from 'inversify';
import { Context, createNamedContext } from '@openland/context';
import { VoiceChatInput, VoiceChatsRepository } from '../repositories/VoiceChatsRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { Modules } from '../../openland-modules/Modules';
import { VoiceChatReportsMediator } from './VoiceChatReportsMediator';
import { inTx } from '@openland/foundationdb';
import { Events } from 'openland-module-hyperlog/Events';
import { Store } from '../../openland-module-db/FDB';
import { RichMessageInput } from '../../openland-module-rich-message/repositories/RichMessageRepository';

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

    createChat = async (ctx: Context, input: VoiceChatInput) => {
        return this.repo.createChat(ctx, input);
    }

    updateChat = async (ctx: Context, by: number, id: number, input: VoiceChatInput) => {
        await Modules.VoiceChats.participants.ensureParticipantIsAdmin(ctx, id, by);

        return this.repo.updateChat(ctx, id, input);
    }

    endChat = async (ctx: Context, by: number, id: number) => {
        await Modules.VoiceChats.participants.ensureParticipantIsAdmin(ctx, id, by);

        return this.repo.setChatActive(ctx, id, false);
    }

    setPinnedMessage = async (ctx: Context, id: number, by: number, message: RichMessageInput) => {
        await Modules.VoiceChats.participants.ensureParticipantIsAdmin(ctx, id, by);
        return await this.repo.setPinnedMessage(ctx, id, by, message);
    }

    deletePinnedMessage = async (ctx: Context, id: number, by: number) => {
        await Modules.VoiceChats.participants.ensureParticipantIsAdmin(ctx, id, by);
        return await this.repo.deletePinnedMessage(ctx, id);
    }

    chatHasActiveVoiceChat = async (ctx: Context, cid: number) => {
        let profile = await Store.RoomProfile.findById(ctx, cid);
        if (!profile || !profile.voiceChat) {
            return false;
        }
        let voiceChat = await Store.ConversationVoice.findById(ctx, profile.voiceChat);
        if (!voiceChat) {
            return false;
        }
        return voiceChat.active;
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