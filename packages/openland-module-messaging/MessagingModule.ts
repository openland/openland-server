import { injectable, inject } from 'inversify';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startEmailNotificationWorker } from './workers/EmailNotificationWorker';
import { startPushNotificationWorker } from './workers/PushNotificationWorker';
import { MessageInput } from './MessageInput';
import { UserStateRepository } from './repositories/UserStateRepository';
import { AugmentationMediator } from './mediators/AugmentationMediator';
import { DeliveryMediator } from './mediators/DeliveryMediator';
import { MessagingMediator } from './mediators/MessagingMediator';
import { RoomMediator } from './mediators/RoomMediator';
import { dialogSearchIndexer } from './workers/dialogSearchIndexer';
import { RoomSearch } from './search/RoomSearch';
import { Context } from '@openland/context';
import { messagesIndexer } from './workers/messagesIndexer';
import { FixerRepository } from './repositories/Fixer';
import { roomsSearchIndexer } from './workers/roomsSearchIndexer';
import { NeedNotificationDeliveryRepository } from './repositories/NeedNotificationDeliveryRepository';
import { UserDialogsRepository } from './repositories/UserDialogsRepository';
import { Store } from '../openland-module-db/FDB';
import { Modules } from '../openland-modules/Modules';
import { hasMention } from './resolvers/ModernMessage.resolver';

@injectable()
export class MessagingModule {
    readonly room: RoomMediator;
    readonly search: RoomSearch = new RoomSearch();
    readonly fixer: FixerRepository;
    readonly needNotificationDelivery: NeedNotificationDeliveryRepository;
    private readonly delivery: DeliveryMediator;
    private readonly messaging: MessagingMediator;
    private readonly augmentation: AugmentationMediator;
    private readonly userState: UserStateRepository;
    private readonly userDialogs: UserDialogsRepository;

    constructor(
        @inject('MessagingMediator') messaging: MessagingMediator,
        @inject('UserStateRepository') userState: UserStateRepository,
        @inject('FixerRepository') fixer: FixerRepository,
        @inject('AugmentationMediator') augmentation: AugmentationMediator,
        @inject('DeliveryMediator') delivery: DeliveryMediator,
        @inject('RoomMediator') room: RoomMediator,
        @inject('NeedNotificationDeliveryRepository') needNotificationDelivery: NeedNotificationDeliveryRepository,
        @inject('UserDialogsRepository') userDialogs: UserDialogsRepository
    ) {
        this.delivery = delivery;
        this.userState = userState;
        this.messaging = messaging;
        this.room = room;
        this.augmentation = augmentation;
        this.fixer = fixer;
        this.needNotificationDelivery = needNotificationDelivery;
        this.userDialogs = userDialogs;
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
    // Dialogs
    //

    findUserDialogs(ctx: Context, uid: number) {
        return this.userDialogs.findUserDialogs(ctx, uid);
    }

    hasActiveDialog(ctx: Context, uid: number, cid: number) {
        return this.userDialogs.hasActiveDialog(ctx, uid, cid);
    }

    //
    // Messaging
    //

    async findTopMessage(ctx: Context, cid: number) {
        return await this.messaging.findTopMessage(ctx, cid);
    }

    async sendMessage(ctx: Context, cid: number, uid: number, message: MessageInput, skipAccessCheck?: boolean) {
        return await this.messaging.sendMessage(ctx, uid, cid, message, skipAccessCheck);
    }

    async editMessage(ctx: Context, mid: number, uid: number, newMessage: MessageInput, markAsEdited: boolean) {
        await this.messaging.editMessage(ctx, mid, uid, newMessage, markAsEdited);
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

    async deleteMessage(ctx: Context, mid: number, uid: number): Promise<void> {
        await this.messaging.deleteMessage(ctx, mid, uid);
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

    async zipUpdatesInBatchesAfter(parent: Context, uid: number, state: string | undefined) {
        return await this.userState.zipUpdatesInBatchesAfter(parent, uid, state);
    }

    async zipUpdatesInBatchesAfterModern(parent: Context, uid: number, state: string | undefined) {
        return await this.userState.zipUpdatesInBatchesAfterModern(parent, uid, state);
    }

    async fetchUserGlobalCounter(parent: Context, uid: number) {
        return await this.userState.fetchUserGlobalCounter(parent, uid);
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

    async isChatMuted(ctx: Context, uid: number, cid: number) {
        return await this.userState.isChatMuted(ctx, uid, cid);
    }

    onGlobalCounterTypeChanged = async (parent: Context, uid: number) => {
        return await this.delivery.onGlobalCounterTypeChanged(parent, uid);
    }

    //
    // Util
    //
    async markUserDialogsForIndexing(ctx: Context, uid: number) {
        let dialogs = await this.findUserDialogs(ctx, uid);
        for (let dialog of dialogs) {
            let conv = await Store.ConversationPrivate.findById(ctx, dialog.cid);
            if (!conv) {
                continue;
            }

            let secondUid = conv.uid1 === uid ? conv.uid2 : conv.uid1;
            this.userDialogs.markForIndexing(ctx, secondUid, dialog.cid);
        }
    }

    async isSilent(ctx: Context, uid: number, mid: number) {
        let message = await Store.Message.findById(ctx, mid);
        if (!message) {
            throw new Error('Invalid message id');
        }
        let senderId = message.uid!;

        // Ignore current user
        if (senderId === uid) {
            return {
                mobile: true,
                desktop: true
            };
        }

        let sender = await Modules.Users.profileById(ctx, senderId);
        let receiver = await Modules.Users.profileById(ctx, uid);
        let conversation = await Store.Conversation.findById(ctx, message.cid);
        let convRoom = await Store.ConversationRoom.findById(ctx, message.cid);

        if (!sender || !receiver || !conversation) {
            return {
                mobile: true,
                desktop: true
            };
        }

        // Ignore service messages for big rooms
        if (convRoom && convRoom.oid && message.isService) {
            let org = await Store.Organization.findById(ctx, convRoom.oid);
            let serviceType = message.serviceMetadata && message.serviceMetadata.type;
            if (org!.kind === 'community' && (serviceType === 'user_kick' || serviceType === 'user_invite')) {
                return {
                    mobile: true,
                    desktop: true
                };
            }
        }

        let userMentioned = hasMention(message, uid);

        let settings = await Modules.Users.getUserSettings(ctx, uid);

        let sendDesktop = settings.desktopNotifications !== 'none';
        let sendMobile = settings.mobileNotifications !== 'none';

        // Filter non-private if only direct messages enabled
        if (settings.desktopNotifications === 'direct') {
            if (conversation.kind !== 'private') {
                sendDesktop = false;
            }
        }
        if (settings.mobileNotifications === 'direct') {
            if (conversation.kind !== 'private') {
                sendMobile = false;
            }
        }

        let conversationSettings = await Modules.Messaging.getRoomSettings(ctx, uid, conversation.id);
        if (conversationSettings.mute && !userMentioned) {
            return {
                mobile: true,
                desktop: true
            };
        }

        if (userMentioned) {
            sendMobile = true;
            sendDesktop = true;
        }

        if (!sendMobile && !sendDesktop) {
            return {
                mobile: true,
                desktop: true
            };
        }

        return {
            mobile: !sendMobile,
            desktop: !sendDesktop
        };
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