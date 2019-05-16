import {
    Conversation,
    ConversationRoom,
    FeatureFlag,
    Message,
    Organization,
    User,
    UserDialogEvent,
    UserDialogSettings,
    UserProfile,
    FeedEvent,
    AuthToken,
    ConversationEvent,
    AppHook,
    Presence,
    EnvironmentVariable,
    Comment,
    CommentEvent,
    UserStorageRecord,
    DebugEvent
} from '../../openland-module-db/schema';
import { GQL } from './SchemaSpec';
import {
    BoldTextSpan, CodeBlockTextSpan, DateTextSpan, InlineCodeTextSpan, InsaneTextSpan, IronyTextSpan, ItalicTextSpan,
    LinkSpan, LoudTextSpan, MessageAttachment, MessageAttachmentFile, MessageButton,
    MessageMention, MessageRichAttachment,
    MessageSpan,
    MultiUserMentionSpan, RoomMentionSpan, RotatingTextSpan,
    UserMentionSpan
} from '../../openland-module-messaging/MessageInput';
import { WelcomeMessageT } from '../../openland-module-messaging/repositories/RoomRepository';
import { FileInfo } from '../../openland-module-media/FileInfo';
import { FLiveStreamItem } from '../../foundation-orm/FLiveStreamItem';

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

    export type DialogUpdateStateRoot = any;
    export type FeedItemRoot = FeedEvent;
    export type ICEServerRoot = any;
    export type ConversationUpdateStateRoot = any;
    export type MediaSessionRoot = any;
    export type MediaStreamRoot = any;
    export type ConferencePeerConnectionRoot = any;
    export type ConferencePeerRoot = any;
    export type ConferenceJoinResultRoot = any;
    export type ConferenceUpdateRoot = any;
    export type ConferenceMemberLeftRoot = any;
    export type ConferenceMemberJoinedRoot = any;
    export type ConferenceRoot = any;
    export type ConferenceMediaRoot = { id: number, peerId: number };
    export type DialogDeletedRoot = any;
    export type ConversationSettingsRoot = UserDialogSettings;
    export type ConversationRoot = Conversation;
    export type AnonymousConversationRoot = Conversation;
    export type SharedConversationRoot = Conversation;
    export type PrivateConversationRoot = Conversation;
    export type GroupConversationRoot = Conversation;
    export type InviteServiceMetadataRoot = any;
    export type KickServiceMetadataRoot = any;
    export type TitleChangeServiceMetadataRoot = any;
    export type PhotoChangeServiceMetadataRoot = any;
    export type UrlAugmentationExtraRoot = any;
    export type UrlAugmentationRoot = any;
    export type ServiceMetadataRoot = any;
    export type MessageReactionRoot = any;
    export type ConversationMessageRoot = Message;
    export type FileMetadataRoot = any;
    export type StickerPackRoot = any;
    export type StickerRoot = any;
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
    export type DialogRoot = any;
    export type DialogsConnectionRoot = any;
    export type SettingsRoot = any;
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
    export type ChannelMemberOrgRoot = any;
    export type ChannelMemberRoot = any;
    export type ChannelInviteRoot = any;
    export type ChannelOrgInviteRoot = any;
    export type ChannelJoinRequestOrgRoot = any;
    export type ChannelConversationConnectionEdgeRoot = any;
    export type ChannelConversationConnectionRoot = any;
    export type ConversationUpdateSingleRoot = any;
    export type ConversationUpdateBatchRoot = any;
    export type ConversationUpdateContainerRoot = any;
    export type ConversationUpdateRoot = any;
    export type ConversationUpdatedRoot = any;
    export type ConversationMessageReceivedRoot = any;
    export type ConversationMessageUpdatedRoot = any;
    export type ConversationMessageDeletedRoot = any;
    export type ConversationLostAccessRoot = any;
    export type DialogUpdateSingleRoot = any;
    export type DialogUpdateBatchRoot = any;
    export type DialogUpdateContainerRoot = any;
    export type DialogUpdateRoot = any;
    export type DialogMessageReceivedRoot = UserDialogEvent;
    export type DialogMessageUpdatedRoot = UserDialogEvent;
    export type DialogMessageDeletedRoot = UserDialogEvent;
    export type DialogMessageReadRoot = UserDialogEvent;
    export type DialogTitleUpdatedRoot = UserDialogEvent;
    export type DialogPhotoUpdatedRoot = UserDialogEvent;
    export type DialogMuteChangedRoot = UserDialogEvent;
    export type DialogBumpRoot = UserDialogEvent;
    export type DialogMentionedChangedRoot = UserDialogEvent;
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
    export type UserRoot = User | UserProfile | number;
    export type UserEdgeRoot = any;
    export type UserConnectionRoot = any;
    export type ChatUserEdgeRoot = any;
    export type ChatUserConnectionRoot = any;
    export type RoomRoot = any;
    export type PrivateRoomRoot = any;
    export type WelcomeMessageRoot = WelcomeMessageT;
    export type SharedRoomRoot = ConversationRoom | Conversation | number;
    export type ShortNameDestinationRoot = any;

    export type RoomMemberRoot = any;
    export type RoomMessageRoot = any;
    export type RoomUserNotificaionSettingsRoot = any;
    export type RoomInviteEmailRequest = any;
    export type RoomInviteRoot = any;
    export type OrganizationRequestedMemberRoot = any;
    export type ConferenceParticipantRoot = any;

    export type RoomConnectionRoot = any;
    export type RoomConnectionEdgeRoot = any;

    export type RoomSuperRoot = any;
    export type MessageAttachmentRoot = GQL.MessageAttachment;
    export type MessageButtonRoot = GQL.MessageButton;
    export type MentionRoot = any;
    export type UserMentionRoot = MessageMention;
    export type SharedRoomMentionRoot = MessageMention;
    export type PostRespondServiceMetadataRoot = any;

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
    export type ModernMessageRoot = Message | Comment;
    export type GeneralMessageRoot = Message | Comment;
    export type ServiceMessageRoot = Message;
    export type MessageSpanRoot = MessageSpan;
    export type MessageKeyboardRoot = { buttons: MessageButton & { id: string } };
    export type ModernMessageButtonRoot = any;
    export type ModernMessageReactionRoot = { userId: number, reaction: string };
    export type MessageSpanUserMentionRoot = UserMentionSpan;
    export type MessageSpanMultiUserMentionRoot = MultiUserMentionSpan;
    export type MessageSpanRoomMentionRoot = RoomMentionSpan;
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
    export type ModernMessageAttachmentRoot = { attachment: MessageAttachment, message: Message };
    export type MessageAttachmentFileRoot = { attachment: MessageAttachmentFile, message: Message };
    export type MessageAttachmentPostRoot = any;
    export type MessageRichAttachmentRoot = { attachment: MessageRichAttachment, message: Message };
    export type ImageRoot = { uuid: string, metadata?: FileInfo, crop?: { x: number, y: number, w: number, h: number }  };

    //
    //  Chat updates
    //
    export type ChatUpdateRoot = ConversationEvent;
    export type ChatUpdateBatchRoot = FLiveStreamItem<ConversationEvent>;
    export type ChatUpdateSingleRoot = FLiveStreamItem<ConversationEvent>;
    export type ChatUpdatedRoot = ConversationEvent;
    export type ChatMessageReceivedRoot = ConversationEvent;
    export type ChatMessageUpdatedRoot = ConversationEvent;
    export type ChatMessageDeletedRoot = ConversationEvent;
    export type ChatLostAccessRoot = ConversationEvent;
    export type ChatUpdateStateRoot = any;
    export type ChatUpdateContainerRoot = FLiveStreamItem<ConversationEvent>;

    //
    //  Search
    //
    export type GlobalSearchEntryRoot = User | Organization | Conversation;

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
    export type CommentsPeerRoot = { peerType: 'message', peerId: number, comments: Comment[] };
    export type CommentEntryRoot = Comment;
    export type CommentUpdateContainerRoot = FLiveStreamItem<CommentEvent>;
    export type CommentUpdateSingleRoot = FLiveStreamItem<CommentEvent>;
    export type CommentUpdateBatchRoot = FLiveStreamItem<CommentEvent>;
    export type CommentUpdateRoot = CommentEvent;
    export type CommentReceivedRoot = CommentEvent;
    export type CommentUpdatedRoot = CommentEvent;
    export type CommentUpdatesStateRoot = { state: string };

    //
    //  Presence
    //
    export type OnlineEventRoot = any;
    export type ChatOnlineEventRoot = any;

    //
    //  Debug
    //
    export type DebugEventRoot = DebugEvent;
    export type DebugEventsStateRoot = { state: string };
}