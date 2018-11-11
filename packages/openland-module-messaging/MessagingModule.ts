import { injectable, inject } from 'inversify';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startEmailNotificationWorker } from './workers/EmailNotificationWorker';
import { startPushNotificationWorker } from './workers/PushNotificationWorker';
import { InvitesRepository } from './repositories/InvitesRepository';
import { inTx } from 'foundation-orm/inTx';
import { ChannelInviteEmails } from './emails/ChannelInviteEmails';
import { MessageInput } from './MessageInput';
import { ConversationEvent } from 'openland-module-db/schema';
import { UserStateRepository } from './repositories/UserStateRepository';
import { AugmentationMediator } from './mediators/AugmentationMediator';
import { DeliveryMediator } from './mediators/DeliveryMediator';
import { MessagingMediator } from './mediators/MessagingMediator';
import { RoomMediator } from './mediators/RoomMediator';

@injectable()
export class MessagingModule {
    readonly room: RoomMediator;
    private readonly delivery: DeliveryMediator;
    private readonly messaging: MessagingMediator;
    private readonly augmentation: AugmentationMediator;
    private readonly invites: InvitesRepository;
    private readonly userState: UserStateRepository;

    constructor(
        @inject('MessagingMediator') messaging: MessagingMediator,
        @inject('UserStateRepository') userState: UserStateRepository,
        @inject('InvitesRepository') invites: InvitesRepository,
        @inject('AugmentationMediator') augmentation: AugmentationMediator,
        @inject('DeliveryMediator') delivery: DeliveryMediator,
        @inject('RoomMediator') room: RoomMediator,
    ) {
        this.delivery = delivery;
        this.userState = userState;
        this.messaging = messaging;
        this.room = room;
        this.invites = invites;
        this.augmentation = augmentation;
    }

    //
    // Start 
    //
    start = () => {
        this.augmentation.start();
        this.delivery.start();
        if (serverRoleEnabled('workers')) {
            startEmailNotificationWorker();
        }
        if (serverRoleEnabled('workers')) {
            startPushNotificationWorker();
        }
    }

    //
    // Conversation Settings
    //

    async getConversationSettings(uid: number, cid: number) {
        return await this.userState.getConversationSettings(uid, cid);
    }

    async getUserNotificationState(uid: number) {
        return await this.userState.getUserNotificationState(uid);
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

    async findTopMessage(cid: number) {
        return await this.messaging.findTopMessage(cid);
    }

    async sendMessage(cid: number, uid: number, message: MessageInput): Promise<ConversationEvent> {
        return await this.messaging.sendMessage(uid, cid, message);
    }

    async editMessage(mid: number, uid: number, newMessage: MessageInput, markAsEdited: boolean): Promise<ConversationEvent> {
        return await this.messaging.editMessage(mid, uid, newMessage, markAsEdited);
    }

    async setReaction(mid: number, uid: number, reaction: string, reset: boolean = false) {
        return await this.messaging.setReaction(mid, uid, reaction, reset);
    }

    async deleteMessage(mid: number, uid: number): Promise<ConversationEvent> {
        return await this.messaging.deleteMessage(mid, uid);
    }

    async readRoom(uid: number, cid: number, mid: number) {
        return await this.messaging.readRoom(uid, cid, mid);
    }

    async markAsSeqRead(uid: number, toSeq: number) {
        return await this.userState.markAsSeqRead(uid, toSeq);
    }

    //
    // Rooms
    //

    async roomMembersCount(conversationId: number, status?: string): Promise<number> {
        return await this.room.roomMembersCount(conversationId, status);
    }
}