import { createAugmentationWorker } from './workers/AugmentationWorker';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startEmailNotificationWorker } from './workers/EmailNotificationWorker';
import { startPushNotificationWorker } from './workers/PushNotificationWorker';
import { MessagingRepository } from './repositories/MessagingRepository';
import { FDB } from 'openland-module-db/FDB';
import { InvitesRepository } from './repositories/InvitesRepository';
import { inTx } from 'foundation-orm/inTx';
import { ChannelInviteEmails } from './emails/ChannelInviteEmails';
import { createDeliveryWorker } from './workers/DeliveryWorker';
import { DialogsRepository } from './repositories/DialogsRepository';
import { FixerRepository } from './repositories/Fixer';
import { RoomRepository } from './repositories/RoomRepository';
import { ConversationRepository } from './repositories/ConversationRepository';
import { MessageInput } from './MessageInput';
import { ConversationEvent } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { injectable } from 'inversify';

@injectable()
export class MessagingModule {
    readonly AugmentationWorker = createAugmentationWorker();
    readonly DeliveryWorker = createDeliveryWorker();
    readonly repo = new MessagingRepository(FDB);
    readonly fixer = new FixerRepository(FDB);
    readonly room = new RoomRepository(FDB);
    readonly conv = new ConversationRepository(FDB);
    readonly dialogs = new DialogsRepository(FDB);
    private readonly invites = new InvitesRepository(FDB);

    // await Modules.Drafts.clearDraft(uid, conversationId);
    //         await Modules.Messaging.DeliveryWorker.pushWork({ messageId: mid });
    start = () => {
        if (serverRoleEnabled('workers')) {
            startEmailNotificationWorker();
        }
        if (serverRoleEnabled('workers')) {
            startPushNotificationWorker();
        }
    }

    async getConversationSettings(uid: number, cid: number) {
        return await this.dialogs.getConversationSettings(uid, cid);
    }

    //
    // Invites
    //

    async resolveInvite(id: string) {
        return await this.invites.resolveInvite(id);
    }

    async createChannelInviteLink(channelId: number, uid: number) {
        return await this.invites.createChannelInviteLink(channelId, uid);
    }

    async refreshChannelInviteLink(channelId: number, uid: number) {
        return await this.invites.refreshChannelInviteLink(channelId, uid);
    }

    async createChannelInvite(channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await inTx(async () => {
            let invite = await this.invites.createChannelInvite(channelId, uid, email, emailText, firstName, lastName);
            await ChannelInviteEmails.sendChannelInviteEmail(invite);
            return invite;
        });
    }

    //
    // Messaging
    //

    async sendMessage(conversationId: number, uid: number, message: MessageInput): Promise<ConversationEvent> {
        return await inTx(async () => {
            let res = await this.repo.sendMessage(conversationId, uid, message);
            await Modules.Drafts.clearDraft(uid, conversationId);
            await this.DeliveryWorker.pushWork({ messageId: res.mid! });
            return res;
        });
    }

    async editMessage(messageId: number, uid: number, newMessage: MessageInput, markAsEdited: boolean): Promise<ConversationEvent> {
        return await inTx(async () => {
            // TODO: Check permissions
            return await this.repo.editMessage(messageId, newMessage, markAsEdited);
        });
    }

    async setReaction(messageId: number, uid: number, reaction: string, reset: boolean = false) {
        return this.repo.setReaction(messageId, uid, reaction, reset);
    }

    async deleteMessage(messageId: number, uid: number): Promise<ConversationEvent> {
        return this.repo.deleteMessage(messageId, uid);
    }

    //
    // Rooms
    //

    async roomMembersCount(conversationId: number, status?: string): Promise<number> {
        return this.room.roomMembersCount(conversationId, status);
    }

    async addToChannel(channelId: number, uid: number) {
        return this.room.addToChannel(channelId, uid);
    }
}