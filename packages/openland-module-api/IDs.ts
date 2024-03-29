import { SecIDFactory } from '@openland/secure-id';
import { Config } from 'openland-config/Config';

export const IdsFactory = new SecIDFactory(Config.authenticationSalt, 'hashids');

export const IDs = {
    Organization: IdsFactory.createId('Organization'),
    OrganizationProfile: IdsFactory.createId('OrganizationProfile'),
    OrganizationAccount: IdsFactory.createId('OrganizationAccount'),
    OrganizationListing: IdsFactory.createId('OrganizationListing'),
    Invite: IdsFactory.createId('Invite'),
    InviteInfo: IdsFactory.createId('InviteInfo'),
    State: IdsFactory.createId('State'),
    County: IdsFactory.createId('County'),
    City: IdsFactory.createId('City'),
    User: IdsFactory.createId('User'),
    Profile: IdsFactory.createId('Profile'),
    Deal: IdsFactory.createId('Deal'),
    Block: IdsFactory.createId('Block'),
    SuperAccount: IdsFactory.createId('SuperAccount'),
    SuperCity: IdsFactory.createId('SuperCity'),
    FeatureFlag: IdsFactory.createId('FeatureFlag'),
    Opportunities: IdsFactory.createId('Opportunities'),
    DebugReader: IdsFactory.createId('DebugReader'),
    Folder: IdsFactory.createId('Folder'),
    FolderItem: IdsFactory.createId('FolderItem'),
    Task: IdsFactory.createId('Task'),
    Conversation: IdsFactory.createId('Conversation'),
    ConversationSuper: IdsFactory.createId('ConversationSuper'),
    ConversationSettings: IdsFactory.createId('ConversationSettings'),
    ConversationMessage: IdsFactory.createId('ConversationMessage'),
    NotificationCounter: IdsFactory.createId('NotificationCounter'),
    CommentMessagePeer: IdsFactory.createId('CommentMessagePeer'),
    CommentFeedItemPeer: IdsFactory.createId('CommentRichMessagePeer'),
    CommentDiscussionPeer: IdsFactory.createId('CommentDiscussionPeer'),
    CommentEntry: IdsFactory.createId('CommentEntry'),
    Settings: IdsFactory.createId('Settings'),
    WallEntity: IdsFactory.createId('WallEntity'),
    PrivateCall: IdsFactory.createId('PrivateCall'),
    Dialog: IdsFactory.createId('Dialog'),
    Message: IdsFactory.createId('Message'),
    Conference: IdsFactory.createId('Conference'),
    ConferenceMedia: IdsFactory.createId('ConferenceMedia'),
    ConferenceParticipant: IdsFactory.createId('ConferenceParticipant'),
    ConferencePeer: IdsFactory.createId('ConferencePeer'),
    FeedItem: IdsFactory.createId('FeedItem'),
    MediaStream: IdsFactory.createStringId('MediaStream'),
    MessageAttachment: IdsFactory.createStringId('MessageAttachment'),
    Comment: IdsFactory.createId('Comment'),
    RichMessage: IdsFactory.createId('RichMessage'),
    KeyboardButton: IdsFactory.createStringId('KeyboardButton'),
    UserStorageRecord: IdsFactory.createId('UserStorageRecord'),
    NotificationCenter: IdsFactory.createId('NotificationCenter'),
    Notification: IdsFactory.createId('Notification'),
    UserBadge: IdsFactory.createId('UserBadge'),
    StickerPack: IdsFactory.createId('StickerPack'),
    Sticker: IdsFactory.createStringId('Sticker'),
    MatchmakingQuestion: IdsFactory.createStringId('MatchmakingQuestion'),
    ChatUpdatesCursor: IdsFactory.createStringId('ChatUpdatesCursor'),
    DialogsUpdatesCursor: IdsFactory.createStringId('DialogsUpdatesCursor'),
    HomeFeedCursor: IdsFactory.createId('HomeFeedCursor'),
    FeedUpdatesCursor: IdsFactory.createStringId('FeedUpdatesCursor'),
    Slide: IdsFactory.createStringId('Slide'),
    FeedChannel: IdsFactory.createId('FeedChannel'),
    MentionSearchCursor: IdsFactory.createId('MentionSearchCursor'),
    OauthApp: IdsFactory.createId('OauthApp'),
    Powerup: IdsFactory.createId('Powerup'),
    ChatPowerup: IdsFactory.createStringId('ChatPowerup'),
    CreditCard: IdsFactory.createStringId('CreditCard'),
    CreditCardSetupIntent: IdsFactory.createStringId('CreditCardSetupIntent'),

    ModernBadge: IdsFactory.createId('ModernBadge'),
    ModernBadgeSearchCursor: IdsFactory.createId('ModernBadgeSearchCursor'),

    WalletAccount: IdsFactory.createId('WalletAccount'),
    WalletTransaction: IdsFactory.createStringId('WalletTransaction'),
    WalletUpdatesCursor: IdsFactory.createStringId('WalletUpdatesCursor'),
    WalletTransactionsCursor: IdsFactory.createStringId('WalletTransactionsCursor'),

    PaymentIntent: IdsFactory.createStringId('PaymentIntent'),
    PaidSubscription: IdsFactory.createStringId('PaidSubscription'),

    Payment: IdsFactory.createStringId('Payment'),
    Purchase: IdsFactory.createStringId('Purchase'),

    PermissionGroup: IdsFactory.createId('PermissionGroup'),
    PermissionRequest: IdsFactory.createStringId('PermissionRequest'),

    DiscoverChatsCollection: IdsFactory.createId('DiscoverChatsCollection'),
    DiscoverEditorsChoiceChat: IdsFactory.createId('DiscoverEditorsChoice'),
    DiscoverPopularNowCursor: IdsFactory.createId('DiscoverPopularNowCursor'),
    DiscoverPopularNowOrganizationCursor: IdsFactory.createId('DiscoverPopularNowOrganizationCursor'),
    DiscoverTopOrganizationCursor: IdsFactory.createId('DiscoverTopOrganizationCursor'),
    DiscoverTopPremiumCursor: IdsFactory.createId('DiscoverTopPremiumCursor'),
    DiscoverTopFreeCursor: IdsFactory.createId('DiscoverTopFreeCursor'),
    GqlTrace: IdsFactory.createId('GqlTrace'),

    Hub: IdsFactory.createId('Hub'),
    Discussion: IdsFactory.createId('Discussion'),
    DiscussionCursor: IdsFactory.createStringId('DiscussionCursor'),

    Session: IdsFactory.createStringId('Session'),

    Contact: IdsFactory.createId('Contact'),
    ContactCursor: IdsFactory.createStringId('ContactCursor'), // deprecated
    ContactCursor2: IdsFactory.createId('ContactCursor2'),
    ContactsUpdatesCursor: IdsFactory.createStringId('ContactsUpdatesCursor'),

    SequenceStateStrict: IdsFactory.createStringId('SequenceState-V1'),
    SequenceStateFlex: IdsFactory.createStringId('SequenceState-V2'),
    
    SequenceUser: IdsFactory.createId('SequenceUser'),
    SequenceChat: IdsFactory.createId('SequenceChat'),
    SequenceChatPrivate: IdsFactory.createId('SequenceChatPrivate'),

    BlackListUpdatesCursor: IdsFactory.createStringId('BlackListUpdatesCursor'),

    ChatSyncAfter: IdsFactory.createId('ChatSyncAfter'),

    VoiceChatParticipant: IdsFactory.createStringId('VoiceChatParticipant'),

    VoiceChatEventsCursor: IdsFactory.createStringId('VoiceChatEventsCursor'),

    AppRelease: IdsFactory.createId('AppRelease')
};
