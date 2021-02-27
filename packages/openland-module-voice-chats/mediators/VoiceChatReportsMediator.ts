import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';
import { boldString, buildMessage, MessagePart, userMention } from '../../openland-utils/MessageBuilder';
import moment from 'moment';

@injectable()
export class VoiceChatReportsMediator {
    sendChatActiveChangedReport = async (ctx: Context, cid: number, active: boolean) => {
        let [reportsCid, botId] = await this.#getReportingInfo(ctx);
        if (!reportsCid || !botId) {
            return;
        }
        let conv = await Store.ConversationVoice.findById(ctx, cid);
        if (!conv) {
            return;
        }
        let parts: MessagePart[] = [];
        if (!active && conv.duration) {
            parts.push('✅ ', moment.utc(conv.duration).format('H[h] m[m]'));
        }
        if (!active) {
            parts.push();
            let participantsTotal = await Store.VoiceChatParticipant.chatAll.findAll(ctx, cid);
            parts.push(' · ', participantsTotal.length.toString(), ' 👤');
        }
        if (active) {
            parts.push('🤙 ');
        } else {
            parts.push(' · ');
        }

        parts.push(boldString(conv.title || 'Unnamed'));
        if (conv.startedBy) {
            let creatorName = await Modules.Users.getUserFullName(ctx, conv.startedBy);
            parts.push(' · ', userMention(creatorName, conv.startedBy));
        }

        await Modules.Messaging.sendMessage(
            ctx,
            reportsCid,
            botId,
            buildMessage(...parts)
        );
    }

    #getReportingInfo = (ctx: Context) => Promise.all([
        Modules.Super.getEnvVar<number>(ctx, 'voice-chat-reports-id'),
        Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id')
    ])
}