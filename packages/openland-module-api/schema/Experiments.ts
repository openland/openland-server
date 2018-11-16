import {
    Conversation, FeatureFlag,
    Message,
    Organization,
    User,
    UserDialogSettings,
    UserProfile
} from '../../openland-module-db/schema';
import { GQL } from './SchemaSpec';

//
//  Root types
//
export namespace GQLRoots {
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
    export type ChannelConversationRoot = any;
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
    export type DialogMessageReceivedRoot = any;
    export type DialogMessageUpdatedRoot = any;
    export type DialogMessageDeletedRoot = any;
    export type DialogMessageReadRoot = any;
    export type DialogTitleUpdatedRoot = any;
    export type DialogPhotoUpdatedRoot = any;
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
}