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
    UserStripeCard,
    Payment,
    Wallet,
    WalletTransaction,
    WalletTransactionCreateShape,
    WalletBalanceChanged,
    WalletTransactionSuccess,
    WalletTransactionCanceled,
    WalletTransactionPending,
    PaymentStatusChanged,
    WalletSubscription,
    PremiumChatSettings,
    WalletSubscriptionCreateShape,
    SuperAdmin,
    RoomParticipant,
    ChannelInvitation,
    ChannelLink,
    WalletPurchase,
    WalletLockedChanged,
    EditorsChoiceChatsCollection,
    EditorsChoiceChat,
    WalletPurchaseCreateShape,
    GqlTrace,
    ConferenceEndStream,
    DiscussionHub,
    Discussion,
    DiscussionDraft,
    UserDialogCallStateChangedEvent,
    Contact,
    OrganizationMember,
    ContactAddedEvent,
    ContactRemovedEvent,
    UserDialogGotAccessEvent,
    UserDialogLostAccessEvent,
    UpdateChatRead,
    UpdateProfileChanged,
    BlackListAddedEvent,
    BlackListRemovedEvent,
    UpdateChatMessage,
    UpdateChatMessageUpdated,
    UpdateChatMessageDeleted,
    ModernBadge,
    UpdateSettingsChanged,
    UpdateChatDraftUpdated,
    UpdateRoomChanged, MessageShape, PrivateMessage,
} from './../../openland-module-db/store';
import { GQL } from './SchemaSpec';
import {
    BoldTextSpan,
    CodeBlockTextSpan,
    DateTextSpan,
    InlineCodeTextSpan,
    InsaneTextSpan,
    IronyTextSpan,
    ItalicTextSpan,
    LinkSpan,
    LoudTextSpan,
    MessageAttachment,
    MessageAttachmentFile,
    MessageButton,
    MessageMention,
    MessageRichAttachment,
    MessageSpan,
    MultiUserMentionSpan,
    RoomMentionSpan,
    RotatingTextSpan,
    UserMentionSpan,
    OrganizationMentionSpan, MessageAttachmentPurchase, HashTagSpan,
} from '../../openland-module-messaging/MessageInput';
import { WelcomeMessageT } from '../../openland-module-messaging/repositories/RoomRepository';
import { FileInfo } from '../../openland-module-media/FileInfo';
import {
    NewCommentNotification, NewMatchmakingProfileNotification, NotificationContent,
} from '../../openland-module-notification-center/repositories/NotificationCenterRepository';
import { UserFullRoot } from '../../openland-module-users/User.resolver';
import { LiveStreamItem, BaseEvent } from '@openland/foundationdb-entity';
import { URLAugmentation } from '../../openland-module-messaging/workers/UrlInfoService';
import { RichMessageReaction, Slide } from '../../openland-module-rich-message/repositories/RichMessageRepository';
import Stripe from 'stripe';
import {
    PostContent, H1Paragraph, H2Paragraph,
    ImageParagraph,
    TextParagraph, PostParagraphSpans, LinkPostSpan, BoldTextPostSpan, ItalicTextPostSpan, IronyTextPostSpan
} from '../../openland-module-discussions/repositories/PostsRepository';
import { GeoIPResponse } from '../../openland-utils/geoIP';
import { Event } from 'openland-module-events/Definitions';

//
//  Root types
//
export namespace GQLRoots {
    //
    //  Basic
    //
    import DebugEmailTypeValues = GQL.DebugEmailTypeValues;
    import PaymentStatusValues = GQL.PaymentStatusValues;
    import WalletTransactionStatusValues = GQL.WalletTransactionStatusValues;
    import WalletSubscriptionStateValues = GQL.WalletSubscriptionStateValues;
    import WalletSubscriptionIntervalValues = GQL.WalletSubscriptionIntervalValues;
    import SuperNotificationTypeValues = GQL.SuperNotificationTypeValues;
    import DialogKindValues = GQL.DialogKindValues;
    import NotificationPreviewValues = GQL.NotificationPreviewValues;
    import OauthScopeValues = GQL.OauthScopeValues;
    import OrganizationMemberRoleValues = GQL.OrganizationMemberRoleValues;
    import SuperAdminRoleValues = GQL.SuperAdminRoleValues;
    import EventPlatformValues = GQL.EventPlatformValues;
    import TaskStatusValues = GQL.TaskStatusValues;
    import MediaStreamIceTransportPolicyValues = GQL.MediaStreamIceTransportPolicyValues;
    import MessageButtonStyleValues = GQL.MessageButtonStyleValues;
    import MessageTypeValues = GQL.MessageTypeValues;
    import PostMessageTypeValues = GQL.PostMessageTypeValues;
    import PushTypeValues = GQL.PushTypeValues;
    import MatchmakingQuestionTypeValues = GQL.MatchmakingQuestionTypeValues;
    import SlideTypeValues = GQL.SlideTypeValues;
    import SlideCoverAlignValues = GQL.SlideCoverAlignValues;
    import FeedChannelSubscriberRoleValues = GQL.FeedChannelSubscriberRoleValues;
    import GlobalSearchEntryKindValues = GQL.GlobalSearchEntryKindValues;
    import SharedMediaTypeValues = GQL.SharedMediaTypeValues;
    import ModernMessageButtonStyleValues = GQL.ModernMessageButtonStyleValues;
    import MessageReactionTypeValues = GQL.MessageReactionTypeValues;
    import MessageSpanTypeValues = GQL.MessageSpanTypeValues;
    import SharedRoomKindValues = GQL.SharedRoomKindValues;
    import RoomMemberRoleValues = GQL.RoomMemberRoleValues;
    import PurchaseStateValues = GQL.PurchaseStateValues;
    import PostContentTypeValues = GQL.PostContentTypeValues;
    import PostSpanTypeValues = GQL.PostSpanTypeValues;
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
    export type SlideTypeRoot = SlideTypeValues;
    export type SlideCoverAlignRoot = SlideCoverAlignValues;
    export type FeedChannelSubscriberRoleRoot = FeedChannelSubscriberRoleValues;
    export type FeedReactionTypeRoot = RichMessageReaction;

    //
    // Calls
    //
    export type ICEServerRoot = GQL.ICEServer;
    export type MediaStreamRoot = ConferenceEndStream;
    export type ConversationUpdateStateRoot = any;
    export type ConferencePeerRoot = ConferencePeer;
    export type ConferencePeerMediaStateRoot = { audioPaused: boolean, videoPaused: boolean, screencastEnabled: boolean };
    export type ConferenceJoinResultRoot = { peerId: string, conference: ConferenceRoot };
    export type ConferenceRoot = ConferenceRoom;
    export type ConferenceMediaRoot = { id: number, peerId: number };
    export type MediaStreamStateRoot = 'need-offer' | 'wait-offer' | 'need-answer' | 'wait-answer' | 'online' | 'completed';
    export type ConferenceStrategyRoot = GQL.ConferenceStrategyValues;
    export type ConferenceKindRoot = GQL.ConferenceKindValues;
    export type MediaStreamIceTransportPolicyRoot = MediaStreamIceTransportPolicyValues;
    export type MediaStreamVideoSourceRoot = GQL.MediaStreamVideoSourceValues;
    export type MediaStreamSettingsRoot = { audioIn: boolean, audioOut: boolean, videoIn: boolean, videoOut: boolean, videoOutSource: MediaStreamVideoSourceRoot, iceTransportPolicy?: MediaStreamIceTransportPolicyValues };
    export type ConferenceSettingsInputRoot = { strategy?: ConferenceStrategyRoot, iceTransportPolicy?: MediaStreamIceTransportPolicyValues };
    export type MediaStreamMediaStateRoot = { videoOut: boolean, videoSource: MediaStreamVideoSourceRoot, audioOut: boolean, videoPaused?: boolean, audioPaused?: boolean };
    export type LocalStreamAudioConfigRoot = { type: 'audio', codec: 'default' | 'opus' };
    export type LocalStreamVideoConfigRoot = { type: 'video', codec: 'default' | 'h264', source: 'default' | 'screen' };
    export type LocalStreamDataChannelConfigRoot = { type: 'dataChannel', ordered: boolean, label: string, id: number };
    export type LocalStreamConfigRoot = LocalStreamAudioConfigRoot | LocalStreamVideoConfigRoot | LocalStreamDataChannelConfigRoot;

    export type IceTransportPolicyRoot = 'relay' | 'all' | 'none';
    export type VideoSourceRoot = 'default' | 'screen';
    export type MediaKindRoot = 'audio' | 'video';
    export type LocalMediaStateRoot = {
        sendVideo: boolean;
        sendAudio: boolean;
        sendScreencast: boolean;
    };
    export type MediaSenderRoot = {
        kind: 'audio' | 'video';
        codecParams?: string | null | undefined;
        videoSource?: 'default' | 'screen' | null | undefined;
    };
    export type MediaReceiverRoot = {
        pid: number;
        kind: 'audio' | 'video';
        videoSource?: 'default' | 'screen' | null | undefined;
    };
    export type MediaDirectionRoot = GQL.MediaDirectionValues;

    //
    // Dialogs Updates
    //
    export type DialogUpdateStateRoot = GQL.DialogUpdateState;
    export type DialogDeletedRoot = UserDialogEvent;

    export type ConversationSettingsRoot = { cid: number, mute: boolean };
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
    export type ConversationMessageRoot = Message | PrivateMessage;
    export type FileMetadataRoot = any;
    export type VideoMetadataRoot = NonNullable<
        Extract<NonNullable<MessageShape['attachmentsModern']>[number], { type: 'file_attachment' }>['videoMetadata']
        >;
    export type StickerPackRoot = StickerPack | number;
    export type UserStickersRoot = {
        favoriteIds: string[];
        packs: StickerPack[];
        unviewedPackIds: number[];
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
    export type ProfileRoot = UserProfile;
    export type AlphaSignupDataRoot = any;
    export type InviteRoot = any;
    export type ResolveInviteEntryRoot = { type: 'org' | 'chat' | 'app' } | ChannelInvitation | ChannelLink;
    export type InviteInfoRoot = any;
    export type AppInviteRoot = any;
    export type AppInviteInfoRoot = any;
    export type InviteHistotyInfoRoot = any;
    export type ReactionRoot = any;
    export type DialogRoot = { cid: number, counter: { unreadCounter: number, haveMention: boolean } };
    export type DialogKindRoot = DialogKindValues;
    export type DialogsConnectionRoot = { items: DialogRoot[], cursor: string | undefined };
    export type ProfileBadgeTypeRoot = 'organization';
    export type ProfileBadgeRoot = { type: ProfileBadgeTypeRoot, text: string };

    //
    // Settings
    //
    export type SettingsRoot = UserSettings;
    export type ChatTypeNotificationSettingsRoot = { showNotification: boolean, sound: boolean };
    export type PlatformNotificationSettingsRoot = {
        direct: ChatTypeNotificationSettingsRoot,
        secretChat: ChatTypeNotificationSettingsRoot,
        organizationChat: ChatTypeNotificationSettingsRoot,
        communityChat: ChatTypeNotificationSettingsRoot,
        comments: ChatTypeNotificationSettingsRoot,
        channels: ChatTypeNotificationSettingsRoot | null,
        notificationPreview: 'name_text' | 'name',
    };
    export type PrivacyWhoCanSeeRoot = GQL.PrivacyWhoCanSeeValues;
    export type PrivacyWhoCanAddToGroupsRoot = GQL.PrivacyWhoCanAddToGroupsValues;
    export type EmailFrequencyRoot = 'never' | '15min' | '1hour' | '24hour' | '1week';
    export type NotificationMessagesRoot = 'all' | 'direct' | 'none';
    export type NotificationCommentsRoot = 'all' | 'direct' | 'none';
    export type NotificationsDelayRoot = 'none' | '1min' | '15min';
    export type CommentsNotificationDeliveryRoot = 'all' | 'none';
    export type NotificationPreviewRoot = NotificationPreviewValues;
    export type AuthPointRoot = GQL.AuthPoint;

    export type OrganizationMemberRoleRoot = OrganizationMemberRoleValues;
    export type OrganizationMemberRoot = any;
    export type JoinedOrganizationMemberRoot = OrganizationMember;
    export type JoinedOrganizationMemberEdgeRoot = { node: JoinedOrganizationMemberRoot, cursor: string };
    export type JoinedOrganizationMembersConnectionRoot = {
        edges: JoinedOrganizationMemberEdgeRoot[],
        pageInfo: PageInfoRoot,
    };
    export type OrganizationIvitedMemberRoot = any;
    export type OrganizationJoinedMemberRoot = any;
    export type SuperAccountRoot = Organization;
    export type SuperAccountStateRoot = 'pending' | 'activated' | 'suspended' | 'deleted';
    export type SuperAdminRoot = SuperAdmin;
    export type SuperAdminRoleRoot = SuperAdminRoleValues;
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

    //
    // Push
    //
    export type PushSettingsRoot = any;
    export type PushTypeRoot = PushTypeValues;

    export type SessionStateRoot = any;
    //
    // Typings
    //
    export type TypingEventRoot = any;
    export type TypingTypeRoot = 'text' | 'photo' | 'file' | 'video' | 'sticker' | 'cancel';

    export type UserRoot = User | UserProfile | number | UserFullRoot;
    export type UserEdgeRoot = any;
    export type UserConnectionRoot = any;
    export type ChatUserEdgeRoot = any;
    export type ChatUserConnectionRoot = any;
    export type OrgUserEdgeRoot = {
        node: UserRoot,
        isMember: boolean,
        cursor: string
    };
    export type OrgUserConnectionRoot = {
        edges: OrgUserEdgeRoot[],
        pageInfo: PageInfoRoot
    };
    export type RoomRoot = Conversation | number;
    export type PrivateRoomRoot = any;
    export type WelcomeMessageRoot = WelcomeMessageT;
    export type SharedRoomRoot = ConversationRoom | Conversation | number;
    export type SharedRoomConnectionRoot = { items: SharedRoomRoot[], cursor: string | null };
    export type UserBadgeRoot = UserBadge;

    export type StatusRoot = NonNullable<UserProfile['modernStatus']>;
    export type CustomStatusRoot = Extract<StatusRoot, { type: 'custom' }>;
    export type BadgeStatusRoot = Extract<StatusRoot, { type: 'badge' }>;

    export type ModernBadgeRoot = ModernBadge;
    export type ModernBadgeAdditionResultRoot = { added: boolean, badge: ModernBadgeRoot };

    export type RoomCallsModeRoot = 'standard' | 'link' | 'disabled';
    export type RoomCallSettingsRoot = {
        mode: RoomCallsModeRoot,
        callLink: string | null
    };
    export type RoomServiceMessageSettingsRoot = {
        joinsMessageEnabled: boolean,
        leavesMessageEnabled: boolean
    };

    export type RoomMemberRoot = RoomParticipant | {
        cid: number,
        uid: number,
        role: 'owner' | 'admin' | 'member',
        status: SharedRoomMembershipStatusRoot,
        invitedBy: number
    };
    export type RoomMemberEdgeRoot = {
        node: RoomMemberRoot,
        cursor: string
    };
    export type RoomMemberConnectionRoot = {
        edges: RoomMemberEdgeRoot[],
        pageInfo: PageInfoRoot,
    };
    export type RoomMessageRoot = Message;
    export type RoomUserNotificaionSettingsRoot = { cid: number, mute: boolean };
    export type RoomInviteRoot = ChannelInvitation | ChannelLink;
    export type OrganizationRequestedMemberRoot = any;

    export type RoomConnectionRoot = any;
    export type RoomConnectionEdgeRoot = any;

    export type RoomSuperRoot = number | Conversation;
    export type MessageAttachmentRoot = GQL.MessageAttachment;
    export type MessageButtonRoot = GQL.MessageButton;
    export type MessageButtonStyleRoot = MessageButtonStyleValues;
    export type MessageTypeRoot = MessageTypeValues;
    export type PostMessageTypeRoot = PostMessageTypeValues;
    export type MentionRoot = any;
    export type UserMentionRoot = MessageMention;
    export type SharedRoomMentionRoot = MessageMention;
    export type PostRespondServiceMetadataRoot = any;

    export type PremiumChatSettingsRoot = PremiumChatSettings | { id: number, price: number, interval?: 'WEEK' | 'MONTH' };

    //
    // Apps
    //
    export type AppProfileRoot = User;
    export type AppTokenRoot = AuthToken;
    export type AppChatRoot = AppHook;
    export type AppStorageValueRoot = UserStorageRecord;
    export type UserEventBusMessageRoot = { message: string };

    //
    // Modern Messaging
    //

    export type MessageRoot = Message | number;
    export type ModernMessageRoot = Message | PrivateMessage | Comment | RichMessage;
    export type GeneralMessageRoot = Message | PrivateMessage | Comment | RichMessage;
    export type StickerMessageRoot = Message | PrivateMessage | Comment;
    export type DonationMessageRoot = Message;
    export type ServiceMessageRoot = Message | PrivateMessage;
    export type MessageSpanRoot = MessageSpan;
    export type MessageKeyboardRoot = { buttons: (MessageButton & { id: string })[][] };
    export type ModernMessageButtonRoot = any;
    export type ModernMessageReactionRoot = { userId: number, reaction: string };
    export type ReactionCounterRoot = { reaction: MessageReactionTypeRoot, count: number, setByMe: boolean };
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
    export type MessageSpanHashTagRoot = HashTagSpan;
    export type MessageSpanAllMentionRoot = DateTextSpan;
    export type ModernMessageAttachmentRoot = { attachment: MessageAttachment, message: Message | PrivateMessage | RichMessage | Comment };
    export type MessageAttachmentFileRoot = { attachment: MessageAttachmentFile, message: Message };
    export type MessageAttachmentPostRoot = any;
    export type MessageAttachmentPurchaseRoot = { attachment: MessageAttachmentPurchase, message: Message };
    export type MessageRichAttachmentRoot = { attachment: MessageRichAttachment, message: Message };
    export type ImageRoot = { uuid: string, metadata?: FileInfo, crop: { x: number, y: number, w: number, h: number } | null };
    export type ImageFallbackRoot = { photo: string, text: string };
    export type MessageSourceRoot = Message | PrivateMessage | Comment;
    export type MessageSourceChatRoot = Message;
    export type MessageSourceCommentRoot = Comment;
    export type SilentMessageInfoRoot = { mobile: boolean, desktop: boolean };
    export type ShowNotificationMessageInfoRoot = { mobile: boolean, desktop: boolean };
    export type GammaMessagesBatchRoot = { haveMoreForward?: boolean, haveMoreBackward?: boolean, messages: ModernMessageRoot[] };
    export type ModernMessagesBatchRoot = { haveMoreForward: boolean, haveMoreBackward: boolean, messages: ModernMessageRoot[] };
    export type MentionPeerRoot = UserProfile | ConversationRoom | Organization;
    export type MessageWithMentionRoot = FeedEvent | Message;
    export type SharedMediaCountersRoot = GQL.SharedMediaCounters;
    export type SharedMediaTypeRoot = SharedMediaTypeValues;
    export type ModernMessageButtonStyleRoot = ModernMessageButtonStyleValues;
    export type MessageReactionTypeRoot = MessageReactionTypeValues;
    export type MessageSpanTypeRoot = MessageSpanTypeValues;
    export type SharedRoomKindRoot = SharedRoomKindValues;
    export type SharedRoomMembershipStatusRoot = 'joined' | 'requested' | 'left' | 'kicked' | 'none';
    export type RoomMemberRoleRoot = RoomMemberRoleValues;
    export type CommonChatsWithUserResponseRoot = { items: SharedRoomRoot[], cursor: string | null, count: number };

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
    export type DialogGotAccessRoot = UserDialogGotAccessEvent;
    export type DialogLostAccessRoot = UserDialogLostAccessEvent;
    export type DialogMentionedChangedRoot = any;
    export type DialogPeerUpdatedRoot = UserDialogPeerUpdatedEvent;
    export type DialogCallStateChangedRoot = UserDialogCallStateChangedEvent;

    //
    //  Search
    //
    export type GlobalSearchEntryRoot = User | Organization | Conversation;
    export type MessageEdgeRoot = { node: MessageWithChatRoot, cursor: string };
    export type SharedMediaMessageEdgeRoot = MessageEdgeRoot & { index: number };
    export type MessageConnectionRoot = { edges: MessageEdgeRoot[], pageInfo: PageInfoRoot };
    export type SharedMediaConnectionRoot = { edges: SharedMediaMessageEdgeRoot[], pageInfo: PageInfoRoot };
    export type MessageWithChatRoot = { message: Message, chat: RoomRoot };
    export type GlobalSearchConnectionRoot = { globalItems: GlobalSearchEntryRoot[], localItems: User[], cursor?: string };
    export type GlobalSearchEntryKindRoot = GlobalSearchEntryKindValues;
    export type MentionSearchUserRoot = { type: 'user', user: User, fromSameChat: boolean };
    export type MentionSearchOrganizationRoot = { type: 'org', organization: Organization };
    export type MentionSearchSharedRoomRoot = { type: 'room', room: Conversation };
    export type MentionSearchEntryRoot = MentionSearchUserRoot | MentionSearchOrganizationRoot | MentionSearchSharedRoomRoot;
    export type MentionSearchConnectionRoot = { items: MentionSearchEntryRoot[], cursor: string | null };

    //
    //  Debug
    //
    export type DebugIDRoot = any;
    export type DebugUserPresenceRoot = Presence;
    export type EnvVarRoot = EnvironmentVariable;
    export type OrganizationChatStatsRoot = any;
    export type DebugEmailTypeRoot = DebugEmailTypeValues;
    export type SuperNotificationTypeRoot = SuperNotificationTypeValues;
    export type GqlTraceRoot = GqlTrace;
    export type GqlTraceConnectionRoot = { items: GqlTraceRoot[], cursor?: string };

    //
    //  Comments
    //
    export type CommentsPeerRoot = { peerType: 'message' | 'feed_item' | 'discussion', peerId: number, comments: Comment[] };
    export type CommentEntryRoot = Comment;
    export type CommentUpdateContainerRoot = LiveStreamItem<CommentEvent>;
    export type CommentUpdateSingleRoot = LiveStreamItem<CommentEvent>;
    export type CommentUpdateBatchRoot = LiveStreamItem<CommentEvent>;
    export type CommentUpdateRoot = CommentEvent;
    export type CommentReceivedRoot = CommentEvent;
    export type CommentUpdatedRoot = CommentEvent;
    export type CommentUpdatesStateRoot = { state: string };
    export type CommentPeerRootRoot = Message | FeedEvent | Discussion;
    export type CommentSubscriptionRoot = CommentsSubscription;
    export type CommentPeerRootMessageRoot = Message;
    export type CommentPeerRootFeedItemRoot = FeedEvent;
    export type CommentPeerRootPostRoot = Discussion;
    export type CommentSubscriptionTypeRoot = 'all' | 'direct';

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
    export type DiscoverChatsCollectionRoot = EditorsChoiceChatsCollection;
    export type DiscoverChatsCollectionConnectionRoot = { items: DiscoverChatsCollectionRoot[], cursor?: string };
    export type PopularNowRoomRoot = { room: RoomProfile, messagesDelta: number };
    export type PopularNowRoomConnectionRoot = { items: PopularNowRoomRoot[], cursor: string | null };
    export type PopularNowOrganizationRoot = { organization: Organization, messagesDelta: number };
    export type PopularNowOrganizationConnectionRoot = { items: PopularNowOrganizationRoot[], cursor: string | null };
    export type NewAndGrowingOrganizationConnectionRoot = { items: OrganizationRoot[], cursor: string | null };
    export type OrganizationConnectionRoot = { items: OrganizationRoot[], cursor: string | null };
    export type EditorsChoiceChatRoot = EditorsChoiceChat;

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
    export type MatchmakingQuestionTypeRoot = MatchmakingQuestionTypeValues;

    //
    //  Shortnames
    //
    export type ShortNameDestinationRoot = User | Organization | FeedChannel | ConversationRoom | EditorsChoiceChatsCollection | DiscussionHub;

    //
    // Oauth
    //
    export type OauthAppRoot = OauthApplication;
    export type OauthContextRoot = OauthContext;
    export type OauthScopeRoot = OauthScopeValues;

    //
    // Geo location
    //
    export type GeoLocationRoot = { long: number; lat: number; };
    export type UserLocationRoot = UserLocation;
    export type IpLocationRoot = GeoIPResponse;

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
    export type WalletTransactionTransferInRoot = WalletTransactionCreateShape['operation'];
    export type WalletTransactionTransferOutRoot = WalletTransactionCreateShape['operation'];
    export type WalletTransactionIncomeRoot = WalletTransactionCreateShape['operation'];
    export type WalletTransactionPurchaseRoot = WalletTransactionCreateShape['operation'];

    export type WalletUpdateContainerRoot = LiveStreamItem<BaseEvent>;
    export type WalletUpdateBatchRoot = LiveStreamItem<BaseEvent>;
    export type WalletUpdateSingleRoot = LiveStreamItem<BaseEvent>;
    export type WalletUpdateBalanceRoot = WalletBalanceChanged;
    export type WalletUpdateTransactionSuccessRoot = WalletTransactionSuccess;
    export type WalletUpdateTransactionCanceledRoot = WalletTransactionCanceled;
    export type WalletUpdateTransactionPendingRoot = WalletTransactionPending;
    export type WalletUpdatePaymentStatusRoot = PaymentStatusChanged;
    export type WalletUpdateLockedRoot = WalletLockedChanged;
    export type WalletTransactionConnectionRoot = any;

    export type WalletUpdateRoot = BaseEvent;

    export type PaymentRoot = Payment;

    export type WalletSubscriptionRoot = WalletSubscription;
    export type WalletProductRoot = WalletSubscriptionCreateShape['proudct'] | WalletPurchaseCreateShape['product'];
    export type WalletProductGroupRoot = WalletSubscriptionCreateShape['proudct'] | WalletPurchaseCreateShape['product'];
    export type WalletProductDonationRoot = WalletSubscriptionCreateShape['proudct'] | WalletPurchaseCreateShape['product'];
    export type WalletProductDonationMessageRoot = WalletPurchaseCreateShape['product'];
    export type WalletProductDonationReactionRoot = WalletPurchaseCreateShape['product'];

    export type WalletIncomeSourceRoot = WalletSubscriptionRoot | PurchaseRoot;

    export type PaymentStatusRoot = PaymentStatusValues;
    export type WalletTransactionStatusRoot = WalletTransactionStatusValues;
    export type WalletSubscriptionStateRoot = WalletSubscriptionStateValues;
    export type WalletSubscriptionIntervalRoot = WalletSubscriptionIntervalValues;
    export type PurchaseRoot = WalletPurchase;
    export type PurchaseStateRoot = PurchaseStateValues;

    //
    // Log
    //
    export type EventPlatformRoot = EventPlatformValues;

    export type TaskStatusRoot = TaskStatusValues;

    //
    // Discussions
    //

    export type ChannelRoot = DiscussionHub;
    export type ChannelTypeRoot = 'system' | 'personal' | 'public' | 'secret';
    export type PostRoot = Discussion;
    export type PostDraftRoot = DiscussionDraft;
    export type PostConnectionRoot = { items: PostRoot[], cursor: string | null };
    export type PostDraftConnectionRoot = { items: DiscussionDraft[], cursor: string | null };
    export type ParagraphRoot = PostContent;
    export type ImageParagraphRoot = ImageParagraph;
    export type TextParagraphRoot = TextParagraph;
    export type H1ParagraphRoot = H1Paragraph;
    export type H2ParagraphRoot = H2Paragraph;
    export type PostContentTypeRoot = PostContentTypeValues;
    export type PostSpanRoot = PostParagraphSpans;
    export type PostSpanLinkRoot = LinkPostSpan;
    export type PostSpanBoldRoot = BoldTextPostSpan;
    export type PostSpanItalicRoot = ItalicTextPostSpan;
    export type PostSpanIronyRoot = IronyTextPostSpan;
    export type PostSpanTypeRoot = PostSpanTypeValues;

    //
    // Sessions
    //
    export type SessionRoot = { token: AuthToken, presence: { lastSeen: number, expires: number } | null };

    //
    // Contacts
    //
    export type ContactRoot = Contact;
    export type ContactConnectionRoot = { items: ContactRoot[], cursor: string | null };
    export type ContactsUpdateContainerRoot = LiveStreamItem<BaseEvent>;
    export type ContactsUpdateRoot = BaseEvent;
    export type ContactAddedRoot = ContactAddedEvent;
    export type ContactRemovedRoot = ContactRemovedEvent;
    export type ContactsStateRoot = { state: string };

    //
    // Black List
    //
    export type BlackListUpdateContainerRoot = LiveStreamItem<BaseEvent>;
    export type BlackListUpdateRoot = BaseEvent;
    export type BlackListAddedRoot = BlackListAddedEvent;
    export type BlackListRemovedRoot = BlackListRemovedEvent;
    export type BlackListUpdatesStateRoot = { state: string };

    //
    // Updates
    //

    export type UpdateChatReadRoot = UpdateChatRead;
    export type UpdateProfileChangedRoot = UpdateProfileChanged;
    export type UpdateMyProfileChangedRoot = UpdateProfileChanged;
    export type UpdateChatMessageRoot = UpdateChatMessage | UpdateChatMessageUpdated;
    export type UpdateChatMessageDeletedRoot = UpdateChatMessageDeleted;
    export type UpdateChatDraftChangedRoot = UpdateChatDraftUpdated;
    export type UpdateSettingsChangedRoot = UpdateSettingsChanged;
    export type UpdateRoomChangedRoot = UpdateRoomChanged;
    export type UpdateEventRoot = Event;

    export type SequenceCommonRoot = { type: 'common', uid: number };
    export type SequenceChatRoot = { type: 'chat', cid: number } | { type: 'chat-private', cid: number, uid: number };
    export type SequenceRoot = SequenceCommonRoot | SequenceChatRoot;
    export type DraftRoot = {
        version: number;
        date: number;
        value: string | null;
    };

    export type UpdateSubscriptionStartedRoot = { type: 'started', seq: number, state: string };
    export type UpdateSubscriptionCheckpointRoot = { type: 'checkpoint', seq: number, state: string };
    export type UpdateSubscriptionEventRoot = { type: 'update', seq: number, pts: number, state: string, update: UpdateEventRoot, sequence: SequenceRoot };
    export type UpdateSubscriptionEphemeralEventRoot = { type: 'update-ephemeral', seq: number, update: UpdateEventRoot, sequence: SequenceRoot };
    export type UpdateSubscriptionRoot = UpdateSubscriptionStartedRoot | UpdateSubscriptionCheckpointRoot | UpdateSubscriptionEventRoot | UpdateSubscriptionEphemeralEventRoot;

    export type UpdatesSequenceStateRoot = { sequence: SequenceRoot, pts: number };
    export type UpdatesStateRoot = { seq: number, state: string, sequences: UpdatesSequenceStateRoot[] };

    export type UpdatesDifferenceEventRoot = { pts: number, event: UpdateEventRoot };
    export type UpdatesSequenceDifferenceRoot = { sequence: SequenceRoot, pts: number, hasMore: boolean, events: UpdatesDifferenceEventRoot[] };
    export type UpdatesDifferenceRoot = { seq: number, state: string, hasMore: boolean, sequences: UpdatesSequenceDifferenceRoot[] };

    export type SequenceDifferenceRoot = { hasMore: boolean, pts: number, sequence: SequenceRoot, events: UpdatesDifferenceEventRoot[] };

    //
    // Chats
    //

    export type SyncChatRoot = { conversation: Conversation, sequence: SequenceRoot };
    export type SyncChatsConnectionRoot = { items: SyncChatRoot[], cursor: string | null };
    export type SequenceChatStatesRoot = { counter: number, mentions: number, readSeq: number };

    export type DebugGlobalCounterRoot = GQL.DebugGlobalCounter;
    export type DebugChatCounterRoot = GQL.DebugChatCounter;
    export type DebugChatStateRoot = GQL.DebugChatState;
}
