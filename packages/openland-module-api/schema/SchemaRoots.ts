import {
    EnvironmentVariable,
    Presence,
    AuthToken,
    FeatureFlag,
    User,
    UserProfile,
    Organization,
    FeedEvent,
    UserStorageRecord,
    UserSettings,
    AppHook,
    DebugEvent,
    UserBadge,
    Notification,
    NotificationCenter,
    UserNotificationCenter,
    NotificationCenterEvent,
    UserDialogEvent,
    UserDialogSettings,
    Conversation,
    ConversationRoom,
    CommentEvent,
    CommentsSubscription,
    CommentEventGlobal,
    Message,
    Comment,
    ConferencePeer,
    ConferenceRoom,
    RoomProfile,
    RichMessage,
    MessageReceivedEvent,
    MessageUpdatedEvent,
    MessageDeletedEvent,
    UserDialogMessageReceivedEvent,
    UserDialogMessageUpdatedEvent,
    UserDialogMessageDeletedEvent,
    UserDialogTitleUpdatedEvent,
    UserDialogPhotoUpdatedEvent,
    UserDialogMuteChangedEvent,
    UserDialogBumpEvent,
    UserDialogPeerUpdatedEvent,
    StickerPack,
    Sticker,
    FeedItemReceivedEvent,
    FeedItemUpdatedEvent,
    FeedItemDeletedEvent,
    MatchmakingRoom,
    MatchmakingProfile,
    FeedChannel,
    FeedChannelAdmin,
    FeedRebuildEvent,
    OauthApplication,
    OauthContext,
    UserLocation,
    ChatPowerup,
    Powerup,
    UserStripeCard,
    PermissionRequest, Payment, Wallet, WalletTransaction, WalletTransactionCreateShape, WalletBalanceChanged, WalletTransactionSuccess, WalletTransactionCanceled, WalletTransactionPending, PaymentStatusChanged
} from './../../openland-module-db/store';
import { GQL } from './SchemaSpec';
import {
    BoldTextSpan, CodeBlockTextSpan, DateTextSpan, InlineCodeTextSpan, InsaneTextSpan, IronyTextSpan, ItalicTextSpan,
    LinkSpan, LoudTextSpan, MessageAttachment, MessageAttachmentFile, MessageButton,
    MessageMention, MessageRichAttachment,
    MessageSpan,
    MultiUserMentionSpan, RoomMentionSpan, RotatingTextSpan,
    UserMentionSpan, OrganizationMentionSpan,
} from '../../openland-module-messaging/MessageInput';
import { WelcomeMessageT } from '../../openland-module-messaging/repositories/RoomRepository';
import { FileInfo } from '../../openland-module-media/FileInfo';
import {
    NewCommentNotification, NewMatchmakingProfileNotification, NotificationContent,
} from '../../openland-module-notification-center/repositories/NotificationCenterRepository';
import { UserFullRoot } from '../../openland-module-users/User.resolver';
import { LiveStreamItem, BaseEvent } from '@openland/foundationdb-entity';
import { URLAugmentation } from '../../openland-module-messaging/workers/UrlInfoService';
import { Slide } from '../../openland-module-rich-message/repositories/RichMessageRepository';
import { PowerupChatUserSettings } from 'openland-module-powerups/PowerupsRepository';
import Stripe from 'stripe';
import { PermissionGroup } from 'openland-module-permissions/PermissionsRepository';

//
//  Root types
//
export namespace GQLRoots {
    //
    //  Basic
    //
    export type MutationRoot = any;
    export type QueryRoot = any;
    export type SubscriptionRoot = any;

    //
    //  Feed
    //
    export type FeedItemRoot = FeedEvent;
    export type FeedPostRoot = FeedEvent;
    export type FeedPostAuthorRoot = User;
    export type FeedUpdateContainerRoot = LiveStreamItem<BaseEvent>;
    export type FeedUpdateRoot = BaseEvent;
    export type FeedItemReceivedRoot = FeedItemReceivedEvent;
    export type FeedItemUpdatedRoot = FeedItemUpdatedEvent;
    export type FeedItemDeletedRoot = FeedItemDeletedEvent;
    export type FeedRebuildNeededRoot = FeedRebuildEvent;
    export type FeedItemConnectionRoot = { items: FeedEvent[], cursor?: string };
    export type SlideRoot = Slide;
    export type TextSlideRoot = Slide;
    export type SlideAttachmentRoot = User | Conversation | Organization;
    export type FeedChannelRoot = FeedChannel;
    export type FeedChannelConnectionRoot = { items: FeedChannelRoot[], cursor?: string };
    export type FeedSubscriptionRoot = FeedChannel;
    export type FeedPostSourceRoot = FeedChannel;
    export type FeedChannelAdminRoot = FeedChannelAdmin;
    export type FeedChannelAdminConnectionRoot = { items: FeedChannelAdmin[], cursor?: string };
    export type FeedChannelEdgeRoot = { node: FeedChannelRoot, cursor: string };
    export type FeedChannelSearchConnectionRoot = { edges: FeedChannelEdgeRoot[], pageInfo: PageInfoRoot };
    export type FeedChannelSubscriberRoot = { user: User, channelId: number };
    export type FeedChannelSubscriberEdgeRoot = { node: FeedChannelSubscriberRoot, cursor: string };
    export type FeedChannelSubscriberConnectionRoot = { edges: FeedChannelSubscriberEdgeRoot[], pageInfo: PageInfoRoot };

    //
    // Calls
    //
    export type ICEServerRoot = GQL.ICEServer;
    export type MediaStreamRoot = GQL.MediaStream;
    export type ConversationUpdateStateRoot = any;
    export type ConferencePeerConnectionRoot = GQL.ConferencePeerConnection;
    export type ConferencePeerRoot = ConferencePeer;
    export type ConferenceJoinResultRoot = { peerId: string, conference: ConferenceRoot };
    export type ConferenceRoot = ConferenceRoom;
    export type ConferenceMediaRoot = { id: number, peerId: number };

    //
    // Dialogs Updates
    //
    export type DialogUpdateStateRoot = GQL.DialogUpdateState;
    export type DialogDeletedRoot = UserDialogEvent;

    export type ConversationSettingsRoot = UserDialogSettings;
    export type ConversationRoot = Conversation;
    export type AnonymousConversationRoot = Conversation;
    export type SharedConversationRoot = Conversation;
    export type PrivateConversationRoot = Conversation;
    export type GroupConversationRoot = Conversation;
    export type ServiceMetadataRoot = any;
    export type InviteServiceMetadataRoot = any;
    export type KickServiceMetadataRoot = any;
    export type TitleChangeServiceMetadataRoot = any;
    export type PhotoChangeServiceMetadataRoot = any;
    export type UrlAugmentationExtraRoot = User | Organization | Conversation;
    export type UrlAugmentationRoot = URLAugmentation;
    export type MessageReactionRoot = { userId: number, reaction: string };
    export type ConversationMessageRoot = Message;
    export type FileMetadataRoot = any;
    export type StickerPackRoot = StickerPack | number;
    export type UserStickersRoot = {
        favoriteIds: string[];
        packs: StickerPack[];
    };
    export type StickerRoot = ImageStickerRoot;
    export type ImageStickerRoot = Sticker | string;
    export type ConversationEventSimpleBatchRoot = any;
    export type ConversationEventRoot = any;
    export type ConversationEventMessageRoot = any;
    export type ConversationEventEditMessageRoot = any;
    export type ConversationEventDeleteRoot = any;
    export type ConversationEventNewMembersRoot = any;
    export type ConversationEventKickRoot = any;
    export type ConversationEventTitleRoot = any;
    export type ConversationEventUpdateRoot = any;
    export type ConversationEventUpdateRoleRoot = any;
    export type ConversationStateRoot = any;
    export type ConversationConnectionRoot = any;
    export type NotificationCounterRoot = any;
    export type ChatReadResultRoot = any;
    export type ComposeSearchResultRoot = any;
    export type GroupConversationMemberRoot = any;
    export type GroupChatUpdateResponseRoot = any;
    export type ConversationUpdateResponseRoot = any;
    export type ConversationBlockedUserRoot = any;
    export type ProfileRoot = UserProfile | User;
    export type AlphaSignupDataRoot = any;
    export type InviteRoot = any;
    export type ResolveInviteEntryRoot = { type: 'org' | 'chat' | 'app' };
    export type InviteInfoRoot = any;
    export type AppInviteRoot = any;
    export type AppInviteInfoRoot = any;
    export type InviteHistotyInfoRoot = any;
    export type ReactionRoot = any;
    export type DialogRoot = { cid: number };
    export type DialogsConnectionRoot = any;
    export type SettingsRoot = UserSettings;
    export type ChatTypeNotificationSettingsRoot = { showNotification: boolean, sound: boolean };
    export type PlatformNotificationSettingsRoot = {
        direct: ChatTypeNotificationSettingsRoot,
        secretChat: ChatTypeNotificationSettingsRoot,
        organizationChat: ChatTypeNotificationSettingsRoot,
        communityChat: ChatTypeNotificationSettingsRoot,
        comments: ChatTypeNotificationSettingsRoot,
        notificationPreview: 'name_text' | 'name',
    };
    export type OrganizationMemberRoot = any;
    export type OrganizationIvitedMemberRoot = any;
    export type OrganizationJoinedMemberRoot = any;
    export type SuperAccountRoot = Organization;
    export type SuperAdminRoot = any;
    export type PageInfoRoot = any;
    export type TaskRoot = any;
    export type ImageCropRoot = any;
    export type ImageRefRoot = any;
    export type RangeRoot = any;
    export type ChannelConversationRoot = Conversation | ConversationRoom;
    export type FeatureFlagRoot = FeatureFlag;
    export type OrganizationContactRoot = any;
    export type OrganizationRoot = Organization;
    export type OrganizationsEdgeRoot = any;
    export type OrganizationsConnectionRoot = any;
    export type OrganizationProfileRoot = any;
    export type PermissionsRoot = { roles: string[] };
    export type ProfilePrefillRoot = GQL.ProfilePrefill;
    export type PushSettingsRoot = any;
    export type SessionStateRoot = any;
    export type TypingEventRoot = any;
    export type UserRoot = User | UserProfile | number | UserFullRoot;
    export type UserEdgeRoot = any;
    export type UserConnectionRoot = any;
    export type ChatUserEdgeRoot = any;
    export type ChatUserConnectionRoot = any;
    export type RoomRoot = Conversation | number;
    export type PrivateRoomRoot = any;
    export type WelcomeMessageRoot = WelcomeMessageT;
    export type SharedRoomRoot = ConversationRoom | Conversation | number;
    export type SharedRoomConnectionRoot = { items: SharedRoomRoot[], cursor: string };
    export type UserBadgeRoot = UserBadge;

    export type RoomMemberRoot = any;
    export type RoomMessageRoot = any;
    export type RoomUserNotificaionSettingsRoot = any;
    export type RoomInviteRoot = any;
    export type OrganizationRequestedMemberRoot = any;

    export type RoomConnectionRoot = any;
    export type RoomConnectionEdgeRoot = any;

    export type RoomSuperRoot = any;
    export type MessageAttachmentRoot = GQL.MessageAttachment;
    export type MessageButtonRoot = GQL.MessageButton;
    export type MentionRoot = any;
    export type UserMentionRoot = MessageMention;
    export type SharedRoomMentionRoot = MessageMention;
    export type PostRespondServiceMetadataRoot = any;

    export type PaidChatSettingsRoot = any;

    //
    // Apps
    //
    export type AppProfileRoot = User;
    export type AppTokenRoot = AuthToken;
    export type AppChatRoot = AppHook;
    export type AppStorageValueRoot = UserStorageRecord;

    //
    // Modern Messaging
    //

    export type MessageRoot = Message | number;
    export type ModernMessageRoot = Message | Comment | RichMessage;
    export type GeneralMessageRoot = Message | Comment | RichMessage;
    export type StickerMessageRoot = Message | Comment;
    export type ServiceMessageRoot = Message;
    export type MessageSpanRoot = MessageSpan;
    export type MessageKeyboardRoot = { buttons: MessageButton & { id: string } };
    export type ModernMessageButtonRoot = any;
    export type ModernMessageReactionRoot = { userId: number, reaction: string };
    export type MessageSpanUserMentionRoot = UserMentionSpan;
    export type MessageSpanMultiUserMentionRoot = MultiUserMentionSpan;
    export type MessageSpanRoomMentionRoot = RoomMentionSpan;
    export type MessageSpanOrganizationMentionRoot = OrganizationMentionSpan;
    export type MessageSpanLinkRoot = LinkSpan;
    export type MessageSpanBoldRoot = BoldTextSpan;
    export type MessageSpanItalicRoot = ItalicTextSpan;
    export type MessageSpanIronyRoot = IronyTextSpan;
    export type MessageSpanInlineCodeRoot = InlineCodeTextSpan;
    export type MessageSpanCodeBlockRoot = CodeBlockTextSpan;
    export type MessageSpanInsaneRoot = InsaneTextSpan;
    export type MessageSpanLoudRoot = LoudTextSpan;
    export type MessageSpanRotatingRoot = RotatingTextSpan;
    export type MessageSpanDateRoot = DateTextSpan;
    export type MessageSpanAllMentionRoot = DateTextSpan;
    export type ModernMessageAttachmentRoot = { attachment: MessageAttachment, message: Message | RichMessage };
    export type MessageAttachmentFileRoot = { attachment: MessageAttachmentFile, message: Message };
    export type MessageAttachmentPostRoot = any;
    export type MessageRichAttachmentRoot = { attachment: MessageRichAttachment, message: Message };
    export type ImageRoot = { uuid: string, metadata?: FileInfo, crop?: { x: number, y: number, w: number, h: number } };
    export type ImageFallbackRoot = { photo: string, text: string };
    export type MessageSourceRoot = Message | Comment;
    export type MessageSourceChatRoot = Message;
    export type MessageSourceCommentRoot = Comment;
    export type SilentMessageInfoRoot = { mobile: boolean, desktop: boolean };
    export type ShowNotificationMessageInfoRoot = { mobile: boolean, desktop: boolean };
    export type GammaMessagesBatchRoot = { haveMoreForward?: boolean, haveMoreBackward?: boolean, messages: Message[] };
    export type MentionPeerRoot = UserProfile | ConversationRoom | Organization;
    export type MessageWithMentionRoot = FeedEvent | Message;
    export type SharedMediaCountersRoot = GQL.SharedMediaCounters;

    //
    //  Chat updates
    //
    export type ChatUpdateRoot = BaseEvent;
    export type ChatUpdateBatchRoot = LiveStreamItem<BaseEvent>;
    export type ChatUpdateSingleRoot = LiveStreamItem<BaseEvent>;
    export type ChatUpdatedRoot = BaseEvent;
    export type ChatMessageReceivedRoot = MessageReceivedEvent;
    export type ChatMessageUpdatedRoot = MessageUpdatedEvent;
    export type ChatMessageDeletedRoot = MessageDeletedEvent;
    export type ChatLostAccessRoot = BaseEvent;
    export type ChatUpdateStateRoot = any;
    export type ChatUpdateContainerRoot = LiveStreamItem<BaseEvent>;

    //
    //  Dialogs updates
    //
    export type DialogUpdateContainerRoot = LiveStreamItem<BaseEvent>;
    export type DialogUpdateSingleRoot = LiveStreamItem<BaseEvent>;
    export type DialogUpdateBatchRoot = LiveStreamItem<BaseEvent>;
    export type DialogUpdateRoot = BaseEvent;
    export type DialogMessageReceivedRoot = UserDialogMessageReceivedEvent;
    export type DialogMessageUpdatedRoot = UserDialogMessageUpdatedEvent;
    export type DialogMessageDeletedRoot = UserDialogMessageDeletedEvent;
    export type DialogMessageReadRoot = UserDialogMessageReceivedEvent;
    export type DialogTitleUpdatedRoot = UserDialogTitleUpdatedEvent;
    export type DialogPhotoUpdatedRoot = UserDialogPhotoUpdatedEvent;
    export type DialogMuteChangedRoot = UserDialogMuteChangedEvent;
    export type DialogBumpRoot = UserDialogBumpEvent;
    export type DialogMentionedChangedRoot = any;
    export type DialogPeerUpdatedRoot = UserDialogPeerUpdatedEvent;

    //
    //  Search
    //
    export type GlobalSearchEntryRoot = User | Organization | Conversation;
    export type MessageEdgeRoot = { node: MessageWithChatRoot, cursor: string };
    export type MessageConnectionRoot = { edges: MessageEdgeRoot[], pageInfo: PageInfoRoot };
    export type MessageWithChatRoot = { message: Message, chat: RoomRoot };
    export type GlobalSearchConnectionRoot = { globalItems: GlobalSearchEntryRoot[], localItems: User[], cursor?: string };

    //
    //  Debug
    //
    export type DebugIDRoot = any;
    export type DebugUserPresenceRoot = Presence;
    export type EnvVarRoot = EnvironmentVariable;
    export type OrganizationChatStatsRoot = any;

    //
    //  Comments
    //
    export type CommentsPeerRoot = { peerType: 'message' | 'feed_item', peerId: number, comments: Comment[] };
    export type CommentEntryRoot = Comment;
    export type CommentUpdateContainerRoot = LiveStreamItem<CommentEvent>;
    export type CommentUpdateSingleRoot = LiveStreamItem<CommentEvent>;
    export type CommentUpdateBatchRoot = LiveStreamItem<CommentEvent>;
    export type CommentUpdateRoot = CommentEvent;
    export type CommentReceivedRoot = CommentEvent;
    export type CommentUpdatedRoot = CommentEvent;
    export type CommentUpdatesStateRoot = { state: string };
    export type CommentPeerRootRoot = Message;
    export type CommentSubscriptionRoot = CommentsSubscription;
    export type CommentPeerRootMessageRoot = Message;
    export type CommentPeerRootFeedItemRoot = FeedEvent;

    export type CommentGlobalUpdateContainerRoot = LiveStreamItem<CommentEventGlobal>;
    export type CommentGlobalUpdateSingleRoot = LiveStreamItem<CommentEventGlobal>;
    export type CommentGlobalUpdateBatchRoot = LiveStreamItem<CommentEventGlobal>;
    export type CommentGlobalUpdateRoot = CommentEventGlobal;
    export type CommentPeerUpdatedRoot = CommentEventGlobal;
    export type CommentGlobalUpdatesStateRoot = { state: string };

    //
    // Discover
    //
    export type TagRoot = any;
    export type TagGroupRoot = any;
    export type DiscoverPageRoot = any;

    //
    //  Presence
    //
    export type OnlineEventRoot = any;
    export type ChatOnlineEventRoot = any;
    export type IsAppInstalledResponseRoot = { installed: boolean, installedAt?: string };

    //
    // Stats
    //
    export type TrendingRoomRoot = { room: RoomProfile, messagesDelta: number };

    //
    //  Debug
    //
    export type DebugEventRoot = DebugEvent;
    export type DebugEventsStateRoot = { state: string };
    export type DebugUserMetricsRoot = GQL.DebugUserMetrics;
    export type DebugGlobalCountersRoot = GQL.DebugGlobalCounters;

    //
    //  Notification Center
    //
    export type NotificationCenterRoot = NotificationCenter | UserNotificationCenter;
    export type NotificationRoot = Notification;
    export type NotificationCenterUpdatesStateRoot = { state: string };
    export type NotificationCenterUpdateSingleRoot = LiveStreamItem<NotificationCenterEvent>;
    export type NotificationCenterUpdateBatchRoot = LiveStreamItem<NotificationCenterEvent>;
    export type NotificationCenterUpdateContainerRoot = LiveStreamItem<NotificationCenterEvent>;
    export type NotificationCenterUpdateRoot = NotificationCenterEvent;
    export type NotificationReceivedRoot = NotificationCenterEvent;
    export type NotificationDeletedRoot = NotificationCenterEvent;
    export type NotificationReadRoot = NotificationCenterEvent;
    export type NotificationUpdatedRoot = NotificationCenterEvent;
    export type NotificationContentUpdatedRoot = NotificationCenterEvent;
    export type UpdatedNotificationContentRoot = { type: 'comment', peerId: number, peerType: string, commentId: number | null, };
    export type UpdatedNotificationContentCommentRoot = { type: 'comment', peerId: number, peerType: string, commentId: number | null, };
    export type NotificationContentRoot = NotificationContent;
    export type NewCommentNotificationRoot = NewCommentNotification;
    export type NewMatchmakingProfilesNotificationRoot = NewMatchmakingProfileNotification;
    export type MentionNotificationRoot = { peerId: number, peerType: string, messageId: number, messageType: string };
    export type NotificationConnectionRoot = { items: Notification[], cursor?: string };
    export type UserChatWithBadgeRoot = { badge: UserBadge, cid: number };

    //
    // Matchmaking
    //
    export type MatchmakingRoomRoot = MatchmakingRoom;
    export type MatchmakingProfileRoot = MatchmakingProfile;
    export type MatchmakingAnswerRoot = TextMatchmakingAnswerRoot | MultiselectMatchmakingAnswerRoot;
    export type TextMatchmakingAnswerRoot = { type: 'text', text: string, question: MatchmakingQuestionRoot };
    export type MultiselectMatchmakingAnswerRoot = { type: 'multiselect', tags: string[], question: MatchmakingQuestionRoot };

    export type TextMatchmakingQuestionRoot = { type: 'text', id: string, title: string, subtitle?: string | null };
    export type MultiselectMatchmakingQuestionRoot = { type: 'multiselect', id: string, title: string, subtitle?: string | null, tags: string[] };
    export type MatchmakingQuestionRoot = TextMatchmakingQuestionRoot | MultiselectMatchmakingQuestionRoot;
    export type MatchmakingPeerRoot = ConversationRoom | Conversation;

    //
    //  Shortnames
    //
    export type ShortNameDestinationRoot = User | Organization | FeedChannel;

    //
    // Oauth
    //
    export type OauthAppRoot = OauthApplication;
    export type OauthContextRoot = OauthContext;

    //
    // Geo location
    //
    export type GeoLocationRoot = { long: number; lat: number; };
    export type UserLocationRoot = UserLocation;

    //
    // Powerups
    //
    export type RoomPowerupRoot = ChatPowerup;
    export type PowerupRoot = Powerup;
    export type PowerupUserSettingsRoot = PowerupChatUserSettings;

    //
    // Billing
    //
    export type CreditCardRoot = UserStripeCard;
    export type CardSetupIntentRoot = Stripe.SetupIntent;
    export type PaymentIntentRoot = Stripe.PaymentIntent;

    export type WalletAccountRoot = Wallet;
    export type WalletTransactionRoot = WalletTransaction;
    export type WalletTransactionOperationRoot = WalletTransactionCreateShape['operation'];
    export type WalletTransactionDepositRoot = WalletTransactionCreateShape['operation'];
    export type WalletTransactionSubscriptionRoot = WalletTransactionCreateShape['operation'];
    export type WalletTransactionTransferRoot = WalletTransactionCreateShape['operation'];
    export type WalletUpdateContainerRoot = LiveStreamItem<BaseEvent>;
    export type WalletUpdateBatchRoot = LiveStreamItem<BaseEvent>;
    export type WalletUpdateSingleRoot = LiveStreamItem<BaseEvent>;
    export type WalletUpdateBalanceRoot = WalletBalanceChanged;
    export type WalletUpdateTransactionSuccessRoot = WalletTransactionSuccess;
    export type WalletUpdateTransactionCanceledRoot = WalletTransactionCanceled;
    export type WalletUpdateTransactionPendingRoot = WalletTransactionPending;
    export type WalletUpdatePaymentStatusRoot = PaymentStatusChanged;
    export type WalletTransactionConnectionRoot = any;

    export type WalletUpdateRoot = BaseEvent;

    export type PaymentRoot = Payment;

    //
    // Permissions
    //
    export type PermissionRequestRoot = PermissionRequest;
    export type PermissionGroupRoot = PermissionGroup;
}
