import { injectable, inject } from 'inversify';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startEmailNotificationWorker } from './workers/EmailNotificationWorker';
import { startPushNotificationWorker } from './workers/PushNotificationWorker';
import { MessageInput } from './MessageInput';
import { ConversationEvent } from 'openland-module-db/schema';
import { UserStateRepository } from './repositories/UserStateRepository';
import { AugmentationMediator } from './mediators/AugmentationMediator';
import { DeliveryMediator } from './mediators/DeliveryMediator';
import { MessagingMediator } from './mediators/MessagingMediator';
import { RoomMediator } from './mediators/RoomMediator';
import { dialogSearchIndexer } from './workers/dialogSearchIndexer';
import { RoomSearch } from './search/RoomSearch';
import { Context } from 'openland-utils/Context';
import { messagesIndexer } from './workers/messagesIndexer';
import { FixerRepository } from './repositories/Fixer';
import { roomsSearchIndexer } from './workers/roomsSerachIndexer';
import { PushNotificationMediator } from './mediators/PushNotificationMediator';

@injectable()
export class MessagingModule {
    readonly room: RoomMediator;
    readonly search: RoomSearch = new RoomSearch();
    readonly fixer: FixerRepository;
    private readonly delivery: DeliveryMediator;
    private readonly pushNotificationMediator: PushNotificationMediator;
    private readonly messaging: MessagingMediator;
    private readonly augmentation: AugmentationMediator;
    private readonly userState: UserStateRepository;

    constructor(
        @inject('MessagingMediator') messaging: MessagingMediator,
        @inject('UserStateRepository') userState: UserStateRepository,
        @inject('FixerRepository') fixer: FixerRepository,
        @inject('AugmentationMediator') augmentation: AugmentationMediator,
        @inject('DeliveryMediator') delivery: DeliveryMediator,
        @inject('PushNotificationMediator') pushNotificationMediator: PushNotificationMediator,
        @inject('RoomMediator') room: RoomMediator,
    ) {
        this.delivery = delivery;
        this.pushNotificationMediator = pushNotificationMediator;
        this.userState = userState;
        this.messaging = messaging;
        this.room = room;
        this.augmentation = augmentation;
        this.fixer = fixer;
    }

    //
    // Start 
    //
    start = () => {
        this.augmentation.start();
        this.delivery.start();
        this.pushNotificationMediator.start();
        if (serverRoleEnabled('workers')) {
            startEmailNotificationWorker();
        }
        if (serverRoleEnabled('workers')) {
            startPushNotificationWorker();
        }
        if (serverRoleEnabled('workers')) {
            dialogSearchIndexer();
        }
        if (serverRoleEnabled('workers')) {
            messagesIndexer();
        }
        if (serverRoleEnabled('workers')) {
            roomsSearchIndexer();
        }

    }

    //
    //  Settings
    //

    async getUserNotificationState(ctx: Context, uid: number) {
        return await this.userState.getUserNotificationState(ctx, uid);
    }

    //
    // Messaging
    //

    async findTopMessage(ctx: Context, cid: number) {
        return await this.messaging.findTopMessage(ctx, cid);
    }

    async sendMessage(ctx: Context, cid: number, uid: number, message: MessageInput, skipAccessCheck?: boolean): Promise<ConversationEvent> {
        return await this.messaging.sendMessage(ctx, uid, cid, message, skipAccessCheck);
    }

    async editMessage(ctx: Context, mid: number, uid: number, newMessage: MessageInput, markAsEdited: boolean): Promise<ConversationEvent> {
        return await this.messaging.editMessage(ctx, mid, uid, newMessage, markAsEdited);
    }

    //
    // Sends message updated event only to chat sequence
    //
    async markMessageUpdated(ctx: Context, mid: number) {
        return await this.messaging.markMessageUpdated(ctx, mid);
    }

    async setReaction(ctx: Context, mid: number, uid: number, reaction: string, reset: boolean = false) {
        return await this.messaging.setReaction(ctx, mid, uid, reaction, reset);
    }

    async deleteMessage(ctx: Context, mid: number, uid: number): Promise<ConversationEvent> {
        return await this.messaging.deleteMessage(ctx, mid, uid);
    }

    async deleteMessages(ctx: Context, mids: number[], uid: number) {
        return await this.messaging.deleteMessages(ctx, mids, uid);
    }

    async readRoom(ctx: Context, uid: number, cid: number, mid: number) {
        return await this.messaging.readRoom(ctx, uid, cid, mid);
    }

    async markAsSeqRead(ctx: Context, uid: number, toSeq: number) {
        return await this.userState.markAsSeqRead(ctx, uid, toSeq);
    }

    async getUserMessagingState(parent: Context, uid: number) {
        return await this.userState.getUserMessagingState(parent, uid);
    }

    async getUserDialogState(parent: Context, uid: number, cid: number) {
        return await this.userState.getUserDialogState(parent, uid, cid);
    }

    //
    // Rooms
    //

    async roomMembersCount(ctx: Context, conversationId: number, status?: string): Promise<number> {
        return await this.room.roomMembersCount(ctx, conversationId, status);
    }

    async getRoomSettings(ctx: Context, uid: number, cid: number) {
        return await this.userState.getRoomSettings(ctx, uid, cid);
    }

    //
    // Hooks handler
    //

    onUserProfileUpdated = async (ctx: Context, uid: number) => {
        await this.delivery.onUserProfileUpdated(ctx, uid);
    }

    onOrganizationProfileUpdated = async (ctx: Context, oid: number) => {
        await this.delivery.onOrganizationProfileUpdated(ctx, oid);
    }
}