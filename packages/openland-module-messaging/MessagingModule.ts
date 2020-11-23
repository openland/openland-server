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
import { hasMention } from './resolvers/ModernMessage.resolver';
import { PremiumChatMediator } from './mediators/PremiumChatMediator';
import { DonationsMediator } from './mediators/DonationsMediator';
import { Modules } from '../openland-modules/Modules';
import { CounterProvider } from './counters/CounterProvider';
import { PrecalculatedCounterProvider } from './counters/PrecalculatedCounterProvider';

export const USE_NEW_COUNTERS = true;

@injectable()
export class MessagingModule {
    readonly room: RoomMediator;
    readonly premiumChat: PremiumChatMediator;
    readonly donations: DonationsMediator;
    readonly search: RoomSearch = new RoomSearch();
    readonly fixer: FixerRepository;
    readonly needNotificationDelivery: NeedNotificationDeliveryRepository;
    readonly delivery: DeliveryMediator;
    readonly counters: CounterProvider = new PrecalculatedCounterProvider();
    readonly messaging: MessagingMediator;
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
        @inject('UserDialogsRepository') userDialogs: UserDialogsRepository,
        @inject('PremiumChatMediator') proChat: PremiumChatMediator,
        @inject('DonationsMediator') donationsMediator: DonationsMediator,
    ) {
        this.delivery = delivery;
        this.userState = userState;
        this.messaging = messaging;
        this.room = room;
        this.augmentation = augmentation;
        this.fixer = fixer;
        this.needNotificationDelivery = needNotificationDelivery;
        this.userDialogs = userDialogs;
        this.premiumChat = proChat;
        this.donations = donationsMediator;
    }

    //
    // Start
    //

    start = async () => {
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

    loadUserDialogs(ctx: Context, uid: number, after: number) {
        return this.messaging.events.userActiveChats.loadChats(ctx, uid, after);
    }

    hasActiveDialog(ctx: Context, uid: number, cid: number) {
        return this.userDialogs.hasActiveDialog(ctx, uid, cid);
    }

    //
    // Messaging
    //

    async findTopMessage(ctx: Context, cid: number, forUid: number) {
        return await this.messaging.findTopMessage(ctx, cid, forUid);
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

    //
    // Counters
    //
    async fetchUserGlobalCounter(parent: Context, uid: number) {
        if (!USE_NEW_COUNTERS) {
            return await this.userState.fetchUserGlobalCounter(parent, uid);
        } else {
            let settings = await Modules.Users.getUserSettings(parent, uid);
            let counterType = settings.globalCounterType || 'unread_chats_no_muted';

            if (counterType === 'unread_messages') {
                return this.messaging.fastCounters.fetchUserGlobalCounter(parent, uid, false, false);
            } else if (counterType === 'unread_chats') {
                return this.messaging.fastCounters.fetchUserGlobalCounter(parent, uid, true, false);
            } else if (counterType === 'unread_messages_no_muted') {
                return this.messaging.fastCounters.fetchUserGlobalCounter(parent, uid, false, true);
            } else if (counterType === 'unread_chats_no_muted') {
                return this.messaging.fastCounters.fetchUserGlobalCounter(parent, uid, true, true);
            }
            return this.messaging.fastCounters.fetchUserGlobalCounter(parent, uid, true, true);
        }
    }

    async fetchUserUnreadMessagesCount(parent: Context, uid: number) {
        if (USE_NEW_COUNTERS) {
            return await this.messaging.fastCounters.fetchUserGlobalCounter(parent, uid, false, false);
        } else {
            return await Store.UserCounter.get(parent, uid);
        }
    }

    async fetchUserCounters(parent: Context, uid: number) {
        return this.messaging.fastCounters.fetchUserCounters(parent, uid);
    }

    async fetchUserCountersForChats(ctx: Context, uid: number, cids: number[], includeAllMention: boolean = true) {
        return this.messaging.fastCounters.fetchUserCountersForChats(ctx, uid, cids, includeAllMention);
    }

    /**
     * Fetches all counters & caches, call this only if you fetch global counter in same tx
     * or if you call this for several chats in same tx
     */
    async fetchUserUnreadInChat(ctx: Context, uid: number, cid: number) {
        if (!USE_NEW_COUNTERS) {
            return await Store.UserDialogCounter.get(ctx, uid, cid);
        }
        let counters = await this.messaging.fastCounters.fetchUserCounters(ctx, uid);

        let chatUnread = counters.find(c => c.cid === cid);
        if (!chatUnread) {
            return 0;
        }
        return chatUnread.unreadCounter;
    }

    /**
     * Fetches all counters & caches, call this only if you fetch global counter in same tx
     * or if you call this for several chats in same tx
     */
    async fetchUserMentionedInChat(ctx: Context, uid: number, cid: number) {
        if (!USE_NEW_COUNTERS) {
            return await Store.UserDialogHaveMention.get(ctx, uid, cid);
        }
        let counters = await this.messaging.fastCounters.fetchUserCounters(ctx, uid);
        let chatUnread = counters.find(c => c.cid === cid);
        if (!chatUnread) {
            return false;
        }
        return chatUnread.haveMention;
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

    async setChatMuted(ctx: Context, uid: number, cid: number, mute: boolean) {
        return await this.userState.setChatMuted(ctx, uid, cid, mute);
    }

    async onGlobalCounterTypeChanged(parent: Context, uid: number) {
        return await this.delivery.onGlobalCounterTypeChanged(parent, uid);
    }

    //
    // Util
    //

    async getSettingsForMessage(ctx: Context, uid: number, mid: number): Promise<{
        mobile: { showNotification: boolean, sound: boolean },
        desktop: { showNotification: boolean, sound: boolean }
    }> {
        let message = await Store.Message.findById(ctx, mid);
        if (!message) {
            throw new Error('Invalid message id');
        }
        let senderId = message.uid!;

        let settings = await Store.UserSettings.findById(ctx, uid);
        if (senderId === uid || !settings || !settings.desktop || !settings.mobile) {
            return {
                mobile: {
                    showNotification: false,
                    sound: false,
                },
                desktop: {
                    showNotification: false,
                    sound: false,
                },
            };
        }

        let conversation = await Store.Conversation.findById(ctx, message.cid);
        let convRoom = await Store.ConversationRoom.findById(ctx, message.cid);
        if (!conversation) {
            throw new Error('Consistency error');
        }

        // Ignore service messages for big rooms
        if (convRoom && convRoom.oid && message.isService) {
            let org = await Store.Organization.findById(ctx, convRoom.oid);
            let serviceType = message.serviceMetadata && message.serviceMetadata.type;
            if (org!.kind === 'community' && (serviceType === 'user_kick' || serviceType === 'user_invite')) {
                return {
                    mobile: {
                        showNotification: false,
                        sound: false,
                    },
                    desktop: {
                        showNotification: false,
                        sound: false,
                    },
                };
            }
        }

        let userMentioned = hasMention(message, uid);

        let { mobile, desktop } = settings;
        let mobileSettings: { showNotification: boolean, sound: boolean } | null = null;
        let desktopSettings: { showNotification: boolean, sound: boolean } | null = null;
        if (conversation.kind === 'private') {
            mobileSettings = mobile.direct;
            desktopSettings = desktop.direct;
        }
        if (convRoom) {
            if (convRoom.isChannel) {
                mobileSettings = mobile.channels ? mobile.channels : { showNotification: true, sound: true };
                desktopSettings = desktop.channels ? desktop.channels : { showNotification: true, sound: true };
            } else if (convRoom.kind === 'group') {
                mobileSettings = mobile.secretChat;
                desktopSettings = desktop.secretChat;
            } else if (convRoom.kind === 'public' && convRoom.oid) {
                let org = await Store.Organization.findById(ctx, convRoom.oid);
                if (!org) {
                    throw new Error('Consistency error');
                }
                mobileSettings = org.kind === 'community' ? mobile.communityChat : mobile.organizationChat;
                desktopSettings = org.kind === 'community' ? desktop.communityChat : desktop.organizationChat;
            }
        }

        if (!mobileSettings || !desktopSettings) {
            // ¯\_(ツ)_/¯ treat deprecated chats as secret chats
            mobileSettings = mobile.secretChat;
            desktopSettings = desktop.secretChat;
        }

        let conversationSettings = await Store.UserDialogSettings.findById(ctx, uid, conversation.id);
        if (conversationSettings && conversationSettings.mute && !userMentioned) {
            mobileSettings = { showNotification: false, sound: false };
            desktopSettings = { showNotification: false, sound: false };
        }

        let isMuted = !mobileSettings.showNotification || !mobileSettings.sound ||
            !desktopSettings.sound || !desktopSettings.showNotification;
        if (isMuted && userMentioned) {
            mobileSettings = { showNotification: true, sound: true };
            desktopSettings = { showNotification: true, sound: true };
        }

        return {
            mobile: mobileSettings,
            desktop: desktopSettings,
        };
    }

    async isShown(ctx: Context, uid: number, mid: number) {
        let messageSettings = await this.getSettingsForMessage(ctx, uid, mid);

        return {
            mobile: messageSettings.mobile.showNotification,
            desktop: messageSettings.desktop.showNotification,
        };
    }

    async isSilent(ctx: Context, uid: number, mid: number) {
        let messageSettings = await this.getSettingsForMessage(ctx, uid, mid);

        return {
            mobile: !messageSettings.mobile.sound,
            desktop: !messageSettings.desktop.sound,
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
