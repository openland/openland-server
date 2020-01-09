import { SecIDFactory } from '@openland/secure-id';

let salt = 'DEBUG_SALT. IF IN PRODUCTION - YOU WILL BE FIRED';
if (!process.env.AUTHENTICATION_SALT || process.env.AUTHENTICATION_SALT.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
        throw Error('AUTHENTICATION_SALT is not set');
    }
} else {
    salt = process.env.AUTHENTICATION_SALT!!.trim();
}

export const IdsFactory = new SecIDFactory(salt, 'hashids');

export const IDs = {
    Organization: IdsFactory.createId('Organization'),
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
    ConversationSettings: IdsFactory.createId('ConversationSettings'),
    ConversationMessage: IdsFactory.createId('ConversationMessage'),
    NotificationCounter: IdsFactory.createId('NotificationCounter'),
    CommentMessagePeer: IdsFactory.createId('CommentMessagePeer'),
    CommentFeedItemPeer: IdsFactory.createId('CommentRichMessagePeer'),
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
    MediaStream: IdsFactory.createId('MediaStream'),
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
    Powerup: IdsFactory.createId('Powerup')
    // FeedChannelUser: IdsFactory.createId('FeedChannelUser')
};