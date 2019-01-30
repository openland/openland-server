import {
    Conversation, ConversationRoom, FeatureFlag,
    Message,
    Organization,
    User, UserDialogEvent,
    UserDialogSettings,
    UserProfile,
    FeedEvent, AuthToken, ConversationEvent, AppHook
} from '../../openland-module-db/schema';
import { GQL } from './SchemaSpec';
import { MessageMention } from '../../openland-module-messaging/MessageInput';
import {
    MessageAttachment, MessageAttachmentFile, MessageRichAttachment,
    MessageSpan,
    RoomMentionSpan,
    UserMentionSpan
} from '../../openland-module-messaging/resolvers/ModernMessage.resolver';
import { FileInfo } from '../../openland-module-media/FileInfo';
import { FLiveStreamItem } from '../../foundation-orm/FLiveStreamItem';

//
//  Root types
//
export namespace GQLRoots {
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
    export type ProfileRoot = any;
    export type AlphaSignupDataRoot = any;
    export type InviteRoot = any;
    export type InviteInfoRoot = any;
    export type AppInviteRoot = any;
    export type AppInviteInfoRoot = any;
    export type InviteHistotyInfoRoot = any;
    export type ReactionRoot = any;
    export type MessageRoot = any;
    export type DialogRoot = any;
    export type DialogsConnectionRoot = any;
    export type SettingsRoot = any;
    export type OrganizationMemberRoot = any;
    export type OrganizationIvitedMemberRoot = any;
    export type OrganizationJoinedMemberRoot = any;
    export type OnlineEventRoot = any;
    export type SuperAccountRoot = any;
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
    export type ConversationMessageReceivedRoot = any;
    export type ConversationMessageUpdatedRoot = any;
    export type ConversationMessageDeletedRoot = any;
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
    export type DialogMentionedChangedRoot = UserDialogEvent;
    export type FeatureFlagRoot = FeatureFlag;
    export type MutationRoot = any;
    export type OrganizationContactRoot = any;
    export type OrganizationRoot = Organization;
    export type OrganizationsEdgeRoot = any;
    export type OrganizationsConnectionRoot = any;
    export type OrganizationProfileRoot = any;
    export type PermissionsRoot = { roles: string[] };
    export type ProfilePrefillRoot = GQL.ProfilePrefill;
    export type PushSettingsRoot = any;
    export type QueryRoot = any;
    export type SessionStateRoot = any;
    export type SubscriptionRoot = any;
    export type TypingEventRoot = any;
    export type UserRoot = User | UserProfile | number;
    export type UserEdgeRoot = any;
    export type UserConnectionRoot = any;
    export type RoomRoot = any;
    export type PrivateRoomRoot = any;
    export type SharedRoomRoot = any;
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

    //
    // Modern Messaging
    //
    export type BaseMessageRoot = Message;
    export type ServiceMessageRoot = Message;
    export type ModernMessageRoot = Message;
    export type MessageSpanRoot = MessageSpan;
    export type MessageAttachmentFileInputRoot = any;
    export type MessageAttachmentPostInputRoot = any;
    export type MessageKeyboardRoot = any;
    export type ModernMessageButtonRoot = any;
    export type ModernMessageReactionRoot = { userId: number, reaction: string };
    export type MessageSpanUserMentionRoot = UserMentionSpan;
    export type MessageSpanRoomMentionRoot = RoomMentionSpan;
    export type ModernMessageAttachmentRoot = MessageAttachment;
    export type MessageAttachmentFileRoot = MessageAttachmentFile;
    export type MessageAttachmentPostRoot = any;
    export type MessageRichAttachmentRoot = MessageRichAttachment;
    export type ImageRoot = { uuid: string, metadata: FileInfo };

    //
    //  ChatUpdates
    //
    export type ChatUpdateRoot = ConversationEvent;
    export type ChatUpdateBatchRoot = FLiveStreamItem<ConversationEvent>;
    export type ChatUpdateSingleRoot = FLiveStreamItem<ConversationEvent>;
    export type ChatMessageReceivedRoot = ConversationEvent;
    export type ChatMessageUpdatedRoot = ConversationEvent;
    export type ChatMessageDeletedRoot = ConversationEvent;
    export type ChatUpdateStateRoot = any;
    export type ChatUpdateContainerRoot = FLiveStreamItem<ConversationEvent>;

    //
    //  Search
    //
    export type GlobalSearchEntryRoot = User | Organization | Conversation;
}