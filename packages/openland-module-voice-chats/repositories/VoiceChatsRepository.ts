import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { fetchNextDBSeq } from '../../openland-utils/dbSeq';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { notifyFastWatch } from '../../openland-module-db/fastWatch';
import { lazyInject } from '../../openland-modules/Modules.container';
import { VoiceChatEventsRepository } from './VoiceChatEventsRepository';
import { ParticipantsRepository } from './ParticipantsRepository';
import { Subject } from 'rxjs';
import { getTransaction } from '@openland/foundationdb';
import {
    RichMessageInput,
    RichMessageRepository
} from '../../openland-module-rich-message/repositories/RichMessageRepository';
import { DeliveryMediator } from '../../openland-module-messaging/mediators/DeliveryMediator';
import { Modules } from '../../openland-modules/Modules';
import { buildServiceMessage, userMention, withServiceMetadata } from '../../openland-utils/MessageBuilder';
import moment from 'moment';

export type VoiceChatInput = {
    title: string
    startedBy?: number
    isPrivate?: boolean
    parentChatId?: number
};

@injectable()
export class VoiceChatsRepository {
    @lazyInject('VoiceChatParticipantsRepository')
    private readonly participants!: ParticipantsRepository;
    @lazyInject('VoiceChatEventsRepository')
    private readonly events!: VoiceChatEventsRepository;
    @lazyInject('RichMessageRepository')
    private readonly richMessageRepo!: RichMessageRepository;
    @lazyInject('DeliveryMediator')
    readonly delivery!: DeliveryMediator;

    public voiceChatActiveChanged = new Subject<{ cid: number, active: boolean }>();

    createChat = async (ctx: Context, input: VoiceChatInput) => {
        let {
            title,
            startedBy,
            isPrivate,
            parentChatId
        } = input;

        let id = await fetchNextDBSeq(ctx, 'conversation-id');
        await Store.Conversation.create(ctx, id, { kind: 'voice' });
        let conv = await Store.ConversationVoice.create(ctx, id, {
            active: true,
            title: title,
            startedBy,
            startedAt: Date.now(),
            isPrivate: isPrivate || false,
            parentChat: parentChatId || null
        });

        await this.#onChatActive(ctx, id);

        getTransaction(ctx).afterCommit(() => {
            this.voiceChatActiveChanged.next({ cid: id, active: true });
        });
        return conv;
    }

    updateChat = async (ctx: Context, id: number, input: VoiceChatInput) => {
        let {
            title,
            isPrivate
        } = input;

        let chat = await this.#getChatOrFail(ctx, id);
        chat.title = title;
        if (isPrivate !== undefined) {
            chat.isPrivate = isPrivate;
        }

        await this.notifyChatUpdated(ctx, id, chat.isPrivate || false);
        return chat;
    }

    setChatActive = async (ctx: Context, id: number, active: boolean) => {
        let chat = await this.#getChatOrFail(ctx, id);
        if (chat.active === active) {
            return chat;
        }
        chat.active = active;
        if (chat.active) {
            chat.startedAt = Date.now();
            chat.endedAt = null;
            chat.duration = null;
            chat.startedAt = Date.now();
            await this.#onChatActive(ctx, id);
        } else {
            let members = await Store.VoiceChatParticipant.chat.findAll(ctx, id);
            await Promise.all(members.map(a => this.participants.leaveChat(ctx, a.cid, a.uid)));
            if (chat.startedAt) {
                chat.endedAt = Date.now();
                chat.duration = chat.endedAt - chat.startedAt;
            }
            await this.#onChatInactive(ctx, id);
        }

        await this.notifyChatUpdated(ctx, id, chat.isPrivate || false);
        getTransaction(ctx).afterCommit(() => {
            this.voiceChatActiveChanged.next({ cid: id, active });
        });
        return chat;
    }

    #onChatActive = async (ctx: Context, id: number) => {
        let chat = await this.#getChatOrFail(ctx, id);
        if (chat.parentChat) {
            // ignore already closed rooms
            if (chat.duration) {
                return;
            }
            // Deliver event to users
            await this.delivery.onVoiceChatStateChanged(ctx, chat.parentChat, true);

            // Deliver event to chat
            await Modules.Messaging.room.markConversationAsUpdated(ctx, chat.parentChat, chat.startedBy!);
            await Modules.Messaging.room.notifyRoomUpdated(ctx, chat.parentChat);

            // Send service message
            let userName = await Modules.Users.getUserFullName(ctx, chat.startedBy!);
            await Modules.Messaging.sendMessage(
                ctx,
                chat.parentChat,
                chat.startedBy!,
                withServiceMetadata(
                    buildServiceMessage(userMention(userName, chat.startedBy!), ' started live room'),
                    { type: 'voice_chat_started' }
                )
            );
        }
    }

    #onChatInactive = async (ctx: Context, id: number) => {
        let chat = await this.#getChatOrFail(ctx, id);
        if (chat.parentChat) {
            // Delete voice chat from parent chat
            let room = await Store.RoomProfile.findById(ctx, chat.parentChat);
            room!.voiceChat = null;
            await room!.flush(ctx);

            // Deliver event to users
            await this.delivery.onVoiceChatStateChanged(ctx, chat.parentChat, false);

            // Deliver event to chat
            await Modules.Messaging.room.markConversationAsUpdated(ctx, chat.parentChat, chat.startedBy!);
            await Modules.Messaging.room.notifyRoomUpdated(ctx, chat.parentChat);

            // Call ended  · 1 h 23 m with Elon Musk and 714 others
            // Send service message

            if (!chat.duration) {
                await Modules.Messaging.sendMessage(
                    ctx,
                    chat.parentChat,
                    chat.startedBy!,
                    withServiceMetadata(buildServiceMessage(`Call ended`), {
                        type: 'voice_chat_ended',
                        duration: 0,
                        membersCount: 0
                    })
                );
                return;
            }

            let duration;

            if (chat.duration < 1000 * 60 * 60) {
                duration = moment.utc(chat.duration).format('m[m]');
            } else {
                duration = moment.utc(chat.duration).format('H[h] m[m]');
            }

            let participants = await Store.VoiceChatParticipant.chat.query(ctx, chat.id, { reverse: true });
            let speakersCount = await Store.VoiceChatParticipantCounter.get(ctx, chat.id, 'speaker');
            let listenersCount = await Store.VoiceChatParticipantCounter.get(ctx, chat.id, 'listener');
            let totalCount = listenersCount + speakersCount;

            let message;

            if (totalCount < 2) {
                message = buildServiceMessage(`Call ended · ${duration}`);
            } else {
                let userName = await Modules.Users.getUserFullName(ctx, participants.items[0].uid);
                message = buildServiceMessage(`Call ended · ${duration} with `, userMention(userName, participants.items[0].uid), ` and ${totalCount - 1} others`);
            }

            if (chat.duration < 1000 * 60) {
                message = buildServiceMessage(`Call ended`);
            }

            await Modules.Messaging.sendMessage(
                ctx,
                chat.parentChat,
                chat.startedBy!,
                withServiceMetadata(message, {
                    type: 'voice_chat_ended',
                    duration: chat.duration,
                    membersCount: totalCount,
                    lastMemberUid: totalCount < 2 ? undefined : participants.items[0].uid
                })
            );
        }
    }

    setPinnedMessage = async (ctx: Context, id: number, by: number, message: RichMessageInput) => {
        let chat = await this.#getChatOrFail(ctx, id);
        if (chat.pinnedMessageId) {
            await this.richMessageRepo.editRichMessage(ctx, by, chat.pinnedMessageId, message, false);
        } else {
            let msg = await this.richMessageRepo.createRichMessage(ctx, by, message);
            chat.pinnedMessageId = msg.id;
            await chat.flush(ctx);
        }
        await this.events.postPinnedMessageUpdated(ctx, id);
        return chat;
    }

    deletePinnedMessage = async (ctx: Context, id: number) => {
        let chat = await this.#getChatOrFail(ctx, id);
        if (chat.pinnedMessageId) {
            chat.pinnedMessageId = null;
            await chat.flush(ctx);
            await this.events.postPinnedMessageUpdated(ctx, id);
        }
        return chat;
    }

    #getChatOrFail = async (ctx: Context, id: number) => {
        let chat = await Store.ConversationVoice.findById(ctx, id);
        if (!chat) {
            throw new NotFoundError();
        }
        return chat;
    }

    notifyChatUpdated = async (ctx: Context, id: number, isPrivate: boolean) => {
        await this.events.postChatUpdated(ctx, id, isPrivate);
        notifyFastWatch(ctx, `voice-chat-${id}`);
    }
}