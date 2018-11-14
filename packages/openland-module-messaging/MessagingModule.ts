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

@injectable()
export class MessagingModule {
    readonly room: RoomMediator;
    readonly search: RoomSearch = new RoomSearch();
    private readonly delivery: DeliveryMediator;
    private readonly messaging: MessagingMediator;
    private readonly augmentation: AugmentationMediator;
    private readonly userState: UserStateRepository;

    constructor(
        @inject('MessagingMediator') messaging: MessagingMediator,
        @inject('UserStateRepository') userState: UserStateRepository,
        @inject('AugmentationMediator') augmentation: AugmentationMediator,
        @inject('DeliveryMediator') delivery: DeliveryMediator,
        @inject('RoomMediator') room: RoomMediator,
    ) {
        this.delivery = delivery;
        this.userState = userState;
        this.messaging = messaging;
        this.room = room;
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
        if (serverRoleEnabled('workers')) {
            dialogSearchIndexer();
        }
    }

    //
    //  Settings
    //

    async getUserNotificationState(uid: number) {
        return await this.userState.getUserNotificationState(uid);
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

    async getRoomSettings(uid: number, cid: number) {
        return await this.userState.getRoomSettings(uid, cid);
    }

    //
    // Hooks handler
    //
    
    onUserProfileUpdated = async (uid: number) => {
        await this.delivery.onUserProfileUpdated(uid);
    }

    onOrganizationProfileUpdated = async (oid: number) => {
        await this.delivery.onOrganizationProfileUpdated(oid);
    }
}