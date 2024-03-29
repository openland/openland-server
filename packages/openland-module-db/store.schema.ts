import {
    declareSchema,
    atomicInt,
    primaryKey,
    atomicBool,
    integer,
    entity,
    field,
    string,
    optional,
    boolean,
    rangeIndex,
    uniqueIndex,
    enumString,
    json,
    struct,
    customDirectory,
    array,
    union,
    event,
    float, allowDelete,
    eventStore
} from '@openland/foundationdb-compiler';
import { taskQueue } from '../openland-module-workers/compiler';

//
// Shared declarations
//
export const basicSpan = struct({
    offset: integer(), length: integer(),
});
export const ImageRef = struct({
    uuid: string(), crop: optional(struct({
        x: integer(), y: integer(), w: integer(), h: integer(),
    })),
});
export const FileInfo = struct({
    name: string(),
    size: integer(),
    isImage: boolean(),
    isStored: boolean(),
    imageWidth: optional(integer()),
    imageHeight: optional(integer()),
    imageFormat: optional(string()),
    mimeType: string(),
});

export const VideoMetadata = struct({
    duration: integer()
});

export const Image = struct({
    image: ImageRef, info: FileInfo,
});
export const Spans = array(union({
    user_mention: struct({
        offset: integer(), length: integer(), user: integer(),
    }),
    multi_user_mention: struct({
        offset: integer(), length: integer(), users: array(integer()),
    }),
    room_mention: struct({
        offset: integer(), length: integer(), room: integer(),
    }),
    link: struct({
        offset: integer(), length: integer(), url: string(),
    }),
    date_text: struct({
        offset: integer(), length: integer(), date: integer(),
    }),
    bold_text: basicSpan,
    italic_text: basicSpan,
    irony_text: basicSpan,
    inline_code_text: basicSpan,
    code_block_text: basicSpan,
    insane_text: basicSpan,
    loud_text: basicSpan,
    rotating_text: basicSpan,
    all_mention: basicSpan,
}));

export const FileAttachment = struct({
    id: string(),
    fileId: string(),
    filePreview: optional(string()),
    fileMetadata: optional(FileInfo),
    previewFileId: optional(string()),
    previewFileMetadata: optional(FileInfo),
    videoMetadata: optional(VideoMetadata)
});

export const RichAttachment = struct({
    id: string(),
    title: optional(string()),
    subTitle: optional(string()),
    titleLink: optional(string()),
    text: optional(string()),
    icon: optional(ImageRef),
    image: optional(ImageRef),
    iconInfo: optional(FileInfo),
    imageInfo: optional(FileInfo),
    imagePreview: optional(string()),
    imageFallback: optional(struct({
        photo: string(), text: string(),
    })),
    titleLinkHostname: optional(string()),
    keyboard: optional(struct({
        buttons: array(array(struct({
            title: string(), style: enumString('DEFAULT', 'LIGHT', 'PAY'), url: optional(string()),
        }))),
    })),
    socialImage: optional(ImageRef),
    socialImagePreview: optional(string()),
    socialImageInfo: optional(FileInfo),
    featuredIcon: optional(boolean())
});

export const PurchaseAttachment = struct({
    id: string(),
    pid: string()
});

import { discussionsStore } from '../openland-module-discussions/Discussions.store';
import { contactsStore } from '../openland-module-contacts/Contacts.store';
import { phoneBookStore } from '../openland-module-phonebook/Phonebook.store';
import { blackListStore } from '../openland-module-blacklist/BlackList.store';
import { defineEvents } from '../openland-module-events/Definitions.store';
import { messagingStore } from '../openland-module-messaging/Messaging.store';
import { socialStore } from '../openland-module-social/Social.store';
import { voiceChatsStore } from '../openland-module-voice-chats/VoiceChats.store';
import { usersStore } from '../openland-module-users/Users.store';
import { scalableStore } from '../openland-module-calls/scalable/Scalable.store';

export default declareSchema(() => {

    usersStore();

    let notificationSettings = struct({
        showNotification: boolean(), sound: boolean(),
    });

    let platformNotificationSettings = struct({
        direct: notificationSettings,
        secretChat: notificationSettings,
        organizationChat: notificationSettings,
        communityChat: notificationSettings,
        comments: notificationSettings,
        channels: optional(notificationSettings),
        notificationPreview: enumString('name_text', 'name'),
    });

    entity('UserSettings', () => {
        primaryKey('id', integer());
        field('emailFrequency', enumString('1hour', '15min', 'never', '24hour', '1week'));
        field('desktopNotifications', enumString('all', 'direct', 'none'));
        field('mobileNotifications', enumString('all', 'direct', 'none'));
        field('commentNotifications', optional(enumString('all', 'direct', 'none')));
        field('commentNotificationsDelivery', optional(enumString('all', 'none')));
        field('mobileAlert', optional(boolean()));
        field('mobileIncludeText', optional(boolean()));
        field('notificationsDelay', optional(enumString('none', '1min', '15min')));
        field('globalCounterType', optional(enumString('unread_messages', 'unread_chats', 'unread_messages_no_muted', 'unread_chats_no_muted')));
        field('desktop', platformNotificationSettings);
        field('mobile', platformNotificationSettings);
        field('privacy', optional(struct({
            whoCanSeeEmail: enumString('everyone', 'nobody'),
            whoCanSeePhone: enumString('everyone', 'nobody'),
            communityAdminsCanSeeContactInfo: optional(boolean()),
            whoCanAddToGroups: optional(enumString('everyone', 'correspondents', 'nobody')),
        })));
    });

    entity('UserIndexingQueue', () => {
        primaryKey('id', integer());
        rangeIndex('updated', ['updatedAt']);
    });

    entity('ModernBadge', () => {
        primaryKey('id', integer());
        field('emoji', string());
        field('text', string());
        field('banned', boolean());
        field('global', boolean());
        field('creatorId', optional(integer()));

        uniqueIndex('duplicates', ['emoji', 'text']);
        rangeIndex('updated', ['updatedAt']);
    });

    entity('UserModernBadge', () => {
        primaryKey('uid', integer());
        primaryKey('bid', integer());

        field('deleted', boolean());

        rangeIndex('byBid', ['bid', 'updatedAt']).withCondition(a => !a.deleted);
        rangeIndex('byUid', ['uid', 'updatedAt']).withCondition(a => !a.deleted);
    });

    //
    // Organization
    //

    entity('Organization', () => {
        primaryKey('id', integer());
        field('ownerId', integer());
        field('status', enumString('pending', 'activated', 'suspended', 'deleted'));
        field('kind', enumString('organization', 'community'));
        field('editorial', boolean());
        field('private', optional(boolean()));
        field('personal', optional(boolean()));
        field('membersCanInvite', optional(boolean()));
        field('autosubscribeRooms', optional(array(integer())));
        rangeIndex('community', []).withCondition((src) => src.kind === 'community' && src.status === 'activated');
    });

    entity('OrganizationProfile', () => {
        primaryKey('id', integer());
        field('name', string());
        field('photo', optional(struct({
            uuid: string(), crop: optional(struct({
                x: integer(), y: integer(), w: integer(), h: integer(),
            })),
        })));
        field('about', optional(string()));
        field('twitter', optional(string()));
        field('facebook', optional(string()));
        field('linkedin', optional(string()));
        field('instagram', optional(string()));
        field('website', optional(string()));
        field('socialImage', optional(ImageRef));

        field('applyLink', optional(string()));
        field('applyLinkEnabled', optional(boolean()));

        field('joinedMembersCount', optional(integer()));
    });

    entity('OrganizationEditorial', () => {
        primaryKey('id', integer());
        field('listed', boolean());
        field('featured', boolean());
    });

    entity('OrganizationMember', () => {
        primaryKey('oid', integer());
        primaryKey('uid', integer());
        field('invitedBy', optional(integer()));
        field('role', enumString('admin', 'member'));
        field('status', enumString('requested', 'joined', 'left'));

        uniqueIndex('ids', ['oid', 'uid']);
        rangeIndex('organization', ['status', 'oid', 'uid']);
        rangeIndex('user', ['status', 'uid', 'oid']);
        rangeIndex('updated', ['updatedAt']);
        rangeIndex('created', ['createdAt']);
        rangeIndex('admins', ['oid', 'uid']).withCondition((src) => src.status === 'joined' && src.role === 'admin');
    });

    entity('OrganizationIndexingQueue', () => {
        primaryKey('id', integer());
        rangeIndex('updated', ['updatedAt']);
    });

    //
    // Presence
    //

    entity('Online', () => {
        primaryKey('uid', integer());
        field('lastSeen', integer());
        field('activeExpires', optional(integer()));
        field('active', optional(boolean()));
    });

    entity('Presence', () => {
        primaryKey('uid', integer());
        primaryKey('tid', string());
        field('lastSeen', integer());
        field('lastSeenTimeout', integer());
        field('platform', string());
        field('active', optional(boolean()));
        rangeIndex('user', ['uid', 'lastSeen']);
    });

    customDirectory('PresenceLog');
    customDirectory('PresenceMobileInstalled');
    customDirectory('UserPresence'); // Obsolete
    customDirectory('UserOnline');

    //
    // Conversations
    //

    entity('Conversation', () => {
        primaryKey('id', integer());
        field('kind', enumString('private', 'organization', 'room', 'voice'));
        field('deleted', optional(boolean()));
        field('archived', optional(boolean()));
    });
    atomicInt('ConversationLastSeq', () => {
        primaryKey('cid', integer());
    });
    entity('ConversationPrivate', () => {
        primaryKey('id', integer());
        field('uid1', integer());
        field('uid2', integer());
        field('pinnedMessage', optional(integer()));
        uniqueIndex('users', ['uid1', 'uid2']);
        uniqueIndex('usersReverse', ['uid2', 'uid1']);
    });

    entity('ConversationOrganization', () => {
        primaryKey('id', integer());
        field('oid', integer());
        uniqueIndex('organization', ['oid']);
    });

    entity('ConversationRoom', () => {
        primaryKey('id', integer());
        field('kind', enumString('organization', 'internal', 'public', 'group'));
        field('oid', optional(integer()));
        field('ownerId', optional(integer()));
        field('featured', optional(boolean()));
        field('listed', optional(boolean()));
        field('isChannel', optional(boolean()));
        field('isPremium', optional(boolean()));
        field('isDeleted', optional(boolean()));
        field('autosubscribeRooms', optional(array(integer())));

        rangeIndex('organization', ['oid'])
            .withCondition((v) => (v.kind === 'public' || v.kind === 'internal') && !v.isDeleted);
        uniqueIndex('organizationPublicRooms', ['oid', 'id'])
            .withCondition((v) => v.kind === 'public' && !v.isDeleted);
    });

    atomicBool('AutoSubscribeWasExecutedForUser', () => {
        primaryKey('uid', integer());
        primaryKey('targetType', enumString('room', 'org'));
        primaryKey('targetId', integer());
    });

    entity('PremiumChatSettings', () => {
        primaryKey('id', integer());
        field('price', integer());
        field('interval', optional(enumString('week', 'month')));
        field('commissionPercents', optional(integer()));
    });

    entity('PremiumChatUserPass', () => {
        primaryKey('cid', integer());
        primaryKey('uid', integer());
        field('sid', optional(string()));
        field('isActive', boolean());
    });

    entity('RoomProfile', () => {
        primaryKey('id', integer());

        field('title', string());
        field('image', optional(json()));
        field('description', optional(string()));
        field('socialImage', optional(json()));
        field('pinnedMessage', optional(integer()));
        field('pinnedMessageOwner', optional(integer()));
        field('welcomeMessageIsOn', optional(boolean()));
        field('welcomeMessageSender', optional(integer()));
        field('welcomeMessageText', optional(string()));

        field('giftStickerPackId', optional(integer()));

        // common settings
        field('repliesDisabled', optional(boolean()));

        // call settings
        field('callsMode', optional(enumString('standard', 'link', 'disabled')));
        field('callLink', optional(string()));

        // service message settings
        field('joinsMessageDisabled', optional(boolean()));
        field('leavesMessageDisabled', optional(boolean()));

        field('activeMembersCount', optional(integer()));

        field('voiceChat', optional(integer()));

        rangeIndex('updated', ['updatedAt']);
        rangeIndex('created', ['createdAt']);
    });

    entity('RoomParticipant', () => {
        primaryKey('cid', integer());
        primaryKey('uid', integer());
        field('invitedBy', integer());
        field('role', enumString('member', 'admin', 'owner'));
        field('status', enumString('joined', 'requested', 'left', 'kicked'));
        uniqueIndex('active', ['cid', 'uid']).withCondition((src) => src.status === 'joined');
        uniqueIndex('requests', ['cid', 'uid']).withCondition((src) => src.status === 'requested');
        uniqueIndex('userActive', ['uid', 'cid']).withCondition((src) => src.status === 'joined');

        rangeIndex('created', ['createdAt']);
        rangeIndex('admins', ['cid', 'uid']).withCondition((src) => src.status === 'joined' && (src.role === 'admin' || src.role === 'owner'));
    });

    customDirectory('RoomParticipantsActive');
    customDirectory('UserChatsActive');
    customDirectory('UserChatsAllIndex');

    atomicInt('RoomParticipantsVersion', () => {
        primaryKey('cid', integer());
    });

    customDirectory('MessageDelivery');
    customDirectory('MessageDeliveryBatch');

    taskQueue('DeliveryFanOut');
    taskQueue('DeliveryUserBatch');

    customDirectory('MessageCounters');

    //
    // Clubhouse
    //
    voiceChatsStore();

    //
    // Messaging
    //
    messagingStore();

    //
    // Social
    //
    socialStore();

    //
    // Comments
    //

    taskQueue('CommentAugmentation');
    taskQueue('CommentNotificationDelivery');
    taskQueue('CommentNotificationBatchDelivery');
    entity('Comment', () => {
        primaryKey('id', integer());
        field('peerId', integer());
        field('peerType', enumString('message', 'feed_item', 'discussion'));
        field('parentCommentId', optional(integer()));
        field('uid', integer());
        field('repeatKey', optional(string()));

        field('text', optional(string())).secure();
        field('stickerId', optional(string()));
        field('reactions', optional(array(struct({
            userId: integer(), reaction: string(),
        }))));
        field('spans', optional(array(union({
            user_mention: struct({
                offset: integer(), length: integer(), user: integer(),
            }),
            multi_user_mention: struct({
                offset: integer(), length: integer(), users: array(integer()),
            }),
            room_mention: struct({
                offset: integer(), length: integer(), room: integer(),
            }),
            organization_mention: struct({
                offset: integer(), length: integer(), organization: integer(),
            }),
            link: struct({
                offset: integer(), length: integer(), url: string(),
            }),
            date_text: struct({
                offset: integer(), length: integer(), date: integer(),
            }),
            bold_text: basicSpan,
            italic_text: basicSpan,
            irony_text: basicSpan,
            inline_code_text: basicSpan,
            code_block_text: basicSpan,
            insane_text: basicSpan,
            loud_text: basicSpan,
            rotating_text: basicSpan,
            all_mention: basicSpan,
        }))));
        field('attachments', optional(array(union({
            file_attachment: FileAttachment,
            rich_attachment: RichAttachment,
        }))));

        // overrides
        field('overrideAvatar', optional(ImageRef));
        field('overrideName', optional(string()));

        field('deleted', optional(boolean()));
        field('edited', optional(boolean()));
        field('visible', optional(boolean()));

        rangeIndex('peer', ['peerType', 'peerId', 'id']);
        rangeIndex('child', ['parentCommentId', 'id']);
        uniqueIndex('repeat', ['peerType', 'peerId', 'repeatKey']).withCondition((src) => !!src.repeatKey);
    });

    //
    // Rich message
    //
    taskQueue('MessageAugmentation');
    taskQueue('MessageMentionNotification');
    entity('RichMessage', () => {
        primaryKey('id', integer());
        field('uid', integer());
        field('oid', optional(integer())); // deprecated

        field('text', optional(string())).secure();
        field('reactions', optional(array(struct({
            userId: integer(), reaction: string(),
        }))));
        field('spans', optional(array(union({
            user_mention: struct({
                offset: integer(), length: integer(), user: integer(),
            }),
            multi_user_mention: struct({
                offset: integer(), length: integer(), users: array(integer()),
            }),
            room_mention: struct({
                offset: integer(), length: integer(), room: integer(),
            }),
            organization_mention: struct({
                offset: integer(), length: integer(), organization: integer(),
            }),
            link: struct({
                offset: integer(), length: integer(), url: string(),
            }),
            date_text: struct({
                offset: integer(), length: integer(), date: integer(),
            }),
            bold_text: basicSpan,
            italic_text: basicSpan,
            irony_text: basicSpan,
            inline_code_text: basicSpan,
            code_block_text: basicSpan,
            insane_text: basicSpan,
            loud_text: basicSpan,
            rotating_text: basicSpan,
            all_mention: basicSpan,
        }))));
        field('attachments', optional(array(union({
            file_attachment: FileAttachment,
            rich_attachment: RichAttachment,
        }))));
        field('slides', optional(array(union({
            text: struct({
                id: string(),
                text: string(),
                spans: optional(Spans),
                cover: optional(Image),
                coverAlign: optional(enumString('top', 'bottom', 'cover')),
                attachments: optional(array(union({
                    user: struct({
                        userId: integer(),
                    }), room: struct({
                        roomId: integer(),
                    }), organization: struct({
                        orgId: integer(),
                    }),
                }))),
            }),
        }))));

        // overrides
        field('overrideAvatar', optional(ImageRef));
        field('overrideName', optional(string()));

        field('edited', optional(boolean()));
        field('deleted', optional(boolean()));

        rangeIndex('user', ['uid', 'createdAt']);
    });

    //
    // Messaging
    //

    entity('MessageDraft', () => {
        primaryKey('uid', integer());
        primaryKey('cid', integer());
        field('contents', optional(string()));
    });

    //
    // Conversation Event
    //

    event('ChatLostAccess', () => {
        field('cid', integer());
        field('forUid', optional(integer()));
    });

    event('ChatUpdatedEvent', () => {
        field('cid', integer());
        field('uid', integer());
    });
    event('MessageReceivedEvent', () => {
        field('cid', integer());
        field('mid', integer());
        field('visibleOnlyForUids', optional(array(integer())));
        field('hiddenForUids', optional(array(integer())));
    });
    event('MessageUpdatedEvent', () => {
        field('cid', integer());
        field('mid', integer());
        field('visibleOnlyForUids', optional(array(integer())));
        field('hiddenForUids', optional(array(integer())));
    });
    event('MessageDeletedEvent', () => {
        field('cid', integer());
        field('mid', integer());
        field('visibleOnlyForUids', optional(array(integer())));
        field('hiddenForUids', optional(array(integer())));
    });
    eventStore('ConversationEventStore', () => {
        primaryKey('cid', integer());
    });

    //
    // Dialog Index events
    //

    event('DialogNeedReindexEvent', () => {
        field('cid', integer());
        field('uid', integer());
    });
    eventStore('DialogIndexEventStore', () => {
        //
    });

    //
    // Deprecated Events
    //

    entity('ConversationSeq', () => {
        primaryKey('cid', integer());
        field('seq', integer());
    });
    entity('ConversationEvent', () => {
        primaryKey('cid', integer());
        primaryKey('seq', integer());
        field('uid', optional(integer()));
        field('mid', optional(integer()));
        field('kind', enumString('chat_updated', 'message_received', 'message_updated', 'message_deleted'));
        rangeIndex('user', ['cid', 'seq']);
    });

    entity('UserDialog', () => {
        primaryKey('uid', integer());
        primaryKey('cid', integer());
        field('unread', integer());
        field('readMessageId', optional(integer()));
        field('date', optional(integer()));
        field('haveMention', optional(boolean()));

        field('title', optional(string()));
        field('photo', optional(json()));

        rangeIndex('user', ['uid', 'date'])
            .withCondition((src) => !!src.date);
        rangeIndex('updated', ['updatedAt']);
    });

    atomicInt('UserDialogReadMessageId', () => {
        primaryKey('uid', integer());
        primaryKey('cid', integer());
    });

    customDirectory('UserDialogIndex');

    customDirectory('UserCountersIndex');

    // DEPRECATED
    customDirectory('FastCounters');
    customDirectory('ExperimentalCounters');
    // DEPRECATED

    customDirectory('NewCounters');
    customDirectory('SyncCounters');
    customDirectory('UserReadSeqs');
    customDirectory('ChatMembers');

    entity('UserDialogSettings', () => {
        primaryKey('uid', integer());
        primaryKey('cid', integer());
        field('mute', boolean());
    });

    entity('UserDialogListSettings', () => {
        primaryKey('uid', integer());
        field('pinnedChats', array(integer()));
    });

    customDirectory('UserDialogMuteSetting');

    event('UserDialogMessageReceivedEvent', () => {
        field('uid', integer());
        field('cid', integer());
        field('mid', integer());
    });
    event('UserDialogMessageUpdatedEvent', () => {
        field('uid', integer());
        field('cid', integer());
        field('mid', integer());
    });
    event('UserDialogMessageDeletedEvent', () => {
        field('uid', integer());
        field('cid', integer());
        field('mid', integer());
    });
    event('UserDialogMessageReadEvent', () => {
        field('uid', integer());
        field('cid', integer());
        field('mid', optional(integer()));
    });
    event('UserDialogTitleUpdatedEvent', () => {
        field('uid', integer());
        field('cid', integer());
        field('title', string());
    });
    event('UserDialogDeletedEvent', () => {
        field('uid', integer());
        field('cid', integer());
    });
    event('UserDialogBumpEvent', () => {
        field('uid', integer());
        field('cid', integer());
    });
    event('UserDialogPhotoUpdatedEvent', () => {
        field('uid', integer());
        field('cid', integer());
        field('photo', optional(ImageRef));
    });
    event('UserDialogMuteChangedEvent', () => {
        field('uid', integer());
        field('cid', integer());
        field('mute', optional(boolean()));
    });
    event('UserDialogPeerUpdatedEvent', () => {
        field('uid', integer());
        field('cid', integer());
    });
    event('UserDialogCallStateChangedEvent', () => {
        field('uid', integer());
        field('cid', integer());
        field('hasActiveCall', boolean());
    });
    event('UserDialogVoiceChatStateChangedEvent', () => {
        field('uid', integer());
        field('cid', integer());
        field('hasActiveVoiceChat', boolean());
    });
    event('UserDialogGotAccessEvent', () => {
        field('uid', integer());
        field('cid', integer());
    });
    event('UserDialogLostAccessEvent', () => {
        field('uid', integer());
        field('cid', integer());
    });
    eventStore('UserDialogEventStore', () => {
        primaryKey('uid', integer());
    });

    //
    // Comments
    //

    entity('CommentState', () => {
        primaryKey('peerType', string());
        primaryKey('peerId', integer());
        field('commentsCount', integer());
    });

    entity('CommentSeq', () => {
        primaryKey('peerType', string());
        primaryKey('peerId', integer());
        field('seq', integer());
    });

    entity('CommentEvent', () => {
        primaryKey('peerType', string());
        primaryKey('peerId', integer());
        primaryKey('seq', integer());
        field('uid', optional(integer()));
        field('commentId', optional(integer()));
        field('kind', enumString('comment_received', 'comment_updated'));
        rangeIndex('user', ['peerType', 'peerId', 'seq']);
    });

    entity('CommentsSubscription', () => {
        primaryKey('peerType', string());
        primaryKey('peerId', integer());
        primaryKey('uid', integer());
        field('kind', enumString('all', 'direct'));
        field('status', enumString('active', 'disabled'));
        rangeIndex('peer', ['peerType', 'peerId', 'uid']);
    });

    entity('CommentEventGlobal', () => {
        primaryKey('uid', integer());
        primaryKey('seq', integer());
        field('peerType', optional(string()));
        field('peerId', optional(integer()));
        field('kind', enumString('comments_peer_updated'));
        rangeIndex('user', ['uid', 'seq']);
    });

    //
    // Conference
    //

    entity('ConferenceRoom', () => {
        primaryKey('id', integer());

        field('scheduler', optional(enumString('mesh', 'mesh-no-relay', 'basic-sfu', 'async-sfu', 'scalable-sfu')));
        field('currentScheduler', optional(enumString('mesh', 'mesh-no-relay', 'basic-sfu', 'async-sfu', 'scalable-sfu')));

        // state
        field('startTime', optional(integer()));
        field('kind', optional(enumString('conference', 'stream')));
        field('screenSharingPeerId', optional(integer()));
        field('streamerId', optional(integer()));
        field('active', optional(boolean()));
    });

    atomicInt('ConferenceRoomVersion', () => {
        primaryKey('id', integer());
    });

    entity('ConferencePeer', () => {
        primaryKey('id', integer());
        field('cid', integer());
        field('uid', integer());
        field('tid', string());
        field('role', optional(enumString('speaker', 'listener'))); // default is speaker
        field('keepAliveTimeout', integer()); // deprecated
        field('enabled', boolean());
        field('videoPaused', optional(boolean()));
        field('audioPaused', optional(boolean()));
        uniqueIndex('auth', ['cid', 'uid', 'tid']).withCondition((src) => src.enabled);
        rangeIndex('user', ['cid', 'uid', 'tid']).withCondition((src) => src.enabled);
        rangeIndex('conference', ['cid', 'keepAliveTimeout']).withCondition((src) => src.enabled);
        rangeIndex('active', ['keepAliveTimeout']).withCondition((src) => src.enabled);
        rangeIndex('byRole', ['cid', 'role', 'id']).withCondition((src) => src.enabled && !!src.role);
    });

    taskQueue('ConferencePeerSync');

    atomicInt('ConferencePeerVersion', () => {
        primaryKey('id', integer());
    });

    customDirectory('ConferencePeerKeepAlive');

    //
    // Media End Stream
    //

    const localSources = struct({
        audioStream: boolean(),
        videoStream: boolean(),
        screenCastStream: boolean()
    });

    const localStream = union({
        audio: struct({
            codec: enumString('default', 'opus'),
            mid: optional(string())
        }),
        video: struct({
            codec: enumString('default', 'h264'),
            source: enumString('default', 'screen'),
            mid: optional(string())
        })
    });

    const remoteStream = union({
        audio: struct({
            mid: optional(string())
        }),
        video: struct({
            source: enumString('default', 'screen'),
            mid: optional(string())
        })
    });

    const remoteMedia = union({
        audio: struct({}),
        video: struct({
            source: enumString('default', 'screen')
        })
    });

    entity('ConferenceEndStream', () => {
        primaryKey('id', string());
        field('pid', integer());

        field('seq', integer());
        field('state', enumString('need-offer', 'wait-offer', 'need-answer', 'wait-answer', 'online', 'completed'));

        // Streams
        field('localStreams', array(localStream));
        field('remoteStreams', array(struct({
            pid: integer(),
            media: remoteStream
        })));

        // Offer/Answer
        field('iceTransportPolicy', enumString('all', 'relay', 'none'));
        field('localSdp', optional(string()));
        field('remoteSdp', optional(string()));

        // Candidates
        field('localCandidates', array(string()));
        field('remoteCandidates', array(string()));

        rangeIndex('peer', ['pid', 'id']).withCondition((s) => s.state !== 'completed');
    });

    customDirectory('EndStream');
    customDirectory('ConferenceScheduling');
    taskQueue('ConferencePeerAdd');
    taskQueue('ConferencePeerUpdate');
    taskQueue('ConferencePeerRemove');

    //
    // Mesh Scheduler
    //

    entity('ConferenceMeshPeer', () => {
        primaryKey('cid', integer());
        primaryKey('pid', integer());
        field('sources', localSources);
        field('active', boolean());
        rangeIndex('conference', ['cid', 'createdAt']).withCondition((src) => src.active);
    });

    entity('ConferenceMeshLink', () => {
        primaryKey('id', string());
        field('cid', integer());
        field('kind', string());
        field('leader', integer());
        field('pid1', integer());
        field('pid2', integer());
        field('esid1', string());
        field('esid2', string());
        field('state', enumString('wait-offer', 'wait-answer', 'online', 'completed'));
        rangeIndex('conference', ['cid', 'createdAt']).withCondition((src) => src.state !== 'completed');
        uniqueIndex('active', ['cid', 'pid1', 'pid2', 'kind']).withCondition((src) => src.state !== 'completed');
    });

    //
    // Kitchen Scheduler
    //

    entity('ConferenceKitchenRouter', () => {
        primaryKey('id', string());
        field('cid', integer());
        field('deleted', boolean());
        uniqueIndex('conference', ['cid']).withCondition((s) => !s.deleted);
    });
    atomicInt('ConferenceKitchenPeersCount', () => {
        primaryKey('id', string());
    });
    atomicInt('ConferenceKitchenConsumersCount', () => {
        primaryKey('id', string());
    });
    atomicInt('ConferenceKitchenProducersCount', () => {
        primaryKey('id', string());
    });
    atomicInt('ConferenceKitchenTransportsCount', () => {
        primaryKey('id', string());
    });

    const capabilities = struct({
        codecs: array(struct({
            kind: string(),
            mimeType: string(),
            preferredPayloadType: integer(),
            clockRate: integer(),
            channels: optional(integer()),
            parameters: array(struct({ key: string(), value: string() })),
            rtcpFeedback: array(struct({ type: string(), value: optional(string()) }))
        })),
        headerExtensions: array(struct({
            kind: string(),
            uri: string(),
            preferredId: integer()
        }))
    });

    entity('ConferenceKitchenPeer', () => {
        primaryKey('pid', integer());
        field('cid', integer());
        field('active', boolean());
        field('capabilities', optional(capabilities));
        field('sources', localSources);
        field('producerTransport', optional(string()));
        field('consumerTransport', optional(string()));
        rangeIndex('conference', ['cid', 'createdAt']).withCondition((src) => src.active);
        rangeIndex('conferenceProducers', ['cid', 'createdAt']).withCondition((src) => !!src.producerTransport);
    });

    entity('ConferenceKitchenProducerTransport', () => {
        primaryKey('id', string());
        field('pid', integer());
        field('cid', integer());

        field('capabilities', optional(capabilities));
        field('state', enumString('negotiation-need-offer', 'negotiation-wait-answer', 'ready', 'closed'));
        field('produces', localSources);
        field('audioProducer', optional(string()));
        field('audioProducerMid', optional(string()));
        field('videoProducer', optional(string()));
        field('videoProducerMid', optional(string()));
        field('screencastProducer', optional(string()));
        field('screencastProducerMid', optional(string()));

        rangeIndex('fromConference', ['cid', 'createdAt']).withCondition((src) => src.state !== 'closed');
    });

    entity('ConferenceKitchenConsumerTransport', () => {
        primaryKey('id', string());
        field('pid', integer());
        field('cid', integer());

        field('capabilities', optional(capabilities));
        field('state', enumString('negotiation-wait-offer', 'negotiation-need-answer', 'ready', 'closed'));
        field('consumes', array(string()));
        field('consumers', array(struct({
            pid: integer(),
            transport: string(),
            consumer: string(),
            media: remoteMedia,
            active: boolean()
        })));

        rangeIndex('fromConference', ['cid', 'createdAt']).withCondition((src) => src.state !== 'closed');
    });

    //
    // Media Kitchen graph
    //

    entity('KitchenWorker', () => {
        primaryKey('id', string());
        field('appData', optional(json()));
        field('deleted', boolean());
        rangeIndex('active', ['id']).withCondition((s) => !s.deleted);
    });

    entity('KitchenRouter', () => {
        primaryKey('id', string());
        field('state', enumString('creating', 'created', 'deleting', 'deleted'));
        field('workerId', optional(string()));

        rangeIndex('workerActive', ['workerId', 'id'])
            .withCondition((s) => !!s.workerId && s.state !== 'deleted');
    });

    entity('KitchenTransport', () => {
        primaryKey('id', string());
        field('routerId', string());
        field('state', enumString('creating', 'created', 'connecting', 'connected', 'deleting', 'deleted'));

        // Server Parameters
        field('serverParameters', optional(struct({
            fingerprints: array(struct({
                algorithm: string(),
                value: string()
            })),
            iceParameters: struct({
                usernameFragment: string(),
                password: string()
            }),
            iceCandidates: array(struct({
                type: string(),
                foundation: string(),
                priority: integer(),
                ip: string(),
                protocol: enumString('tcp', 'udp'),
                port: integer(),
            }))
        })));

        // Client Parameters
        field('clientParameters', optional(struct({
            dtlsRole: optional(enumString('server', 'client')),
            fingerprints: array(struct({
                algorithm: string(),
                value: string()
            }))
        })));

        rangeIndex('routerActive', ['routerId', 'id'])
            .withCondition((s) => s.state !== 'deleted');
    });

    const rtpParameters = struct({
        mid: optional(string()),
        codecs: array(struct({
            mimeType: string(),
            payloadType: integer(),
            clockRate: integer(),
            channels: optional(integer()),
            parameters: optional(json()),
            rtcpFeedback: optional(array(struct({
                type: string(),
                parameter: optional(string())
            })))
        })),
        headerExtensions: optional(array(struct({
            uri: string(),
            id: integer(),
            encrypt: optional(boolean()),
            parameters: json()
        }))),
        encodings: optional(array(struct({
            ssrc: optional(integer()),
            rid: optional(string()),
            codecPayloadType: optional(integer()),
            rtx: optional(struct({ ssrc: integer() })),
            dtx: optional(boolean()),
            scalabilityMode: optional(string())
        }))),
        rtcp: optional(struct({
            cname: optional(string()),
            reducedSize: optional(boolean()),
            mux: optional(boolean())
        })),
    });

    const rtpCapabilities = struct({
        codecs: optional(array(struct({
            kind: enumString('audio', 'video'),
            mimeType: string(),
            clockRate: integer(),
            channels: optional(integer()),
            parameters: json(),
            rtcpFeedback: optional(array(struct({
                type: string(),
                parameter: optional(string())
            })))
        }))),
        headerExtensions: optional(array(struct({
            uri: string(),
            preferredId: integer(),
            kind: optional(enumString('', 'audio', 'video')),
            preferredEncrypt: optional(boolean()),
            direction: optional(enumString('sendrecv', 'sendonly', 'recvonly', 'inactive'))
        }))),
        fecMechanisms: optional(array(string()))
    });

    entity('KitchenProducer', () => {
        primaryKey('id', string());
        field('routerId', string());
        field('transportId', string());
        field('rawId', optional(string()));
        field('state', enumString('creating', 'created', 'deleting', 'deleted'));

        field('parameters', struct({
            kind: enumString('audio', 'video'),
            rtpParameters: rtpParameters,
            keyFrameRequestDelay: optional(integer()),
            paused: optional(boolean())
        }));
        field('rtpParameters', optional(rtpParameters));
        field('paused', boolean());

        rangeIndex('routerActive', ['routerId', 'id'])
            .withCondition((s) => s.state !== 'deleted');
        rangeIndex('transportActive', ['transportId', 'id'])
            .withCondition((s) => s.state !== 'deleted');
    });

    entity('KitchenConsumer', () => {
        primaryKey('id', string());
        field('routerId', string());
        field('transportId', string());
        field('producerId', string());
        field('state', enumString('creating', 'created', 'deleting', 'deleted'));
        field('parameters', struct({
            rtpCapabilities: optional(rtpCapabilities),
            preferredLayers: optional(struct({
                spatialLayer: integer(),
                temporalLayer: optional(integer())
            })),
            paused: optional(boolean())
        }));
        field('rtpParameters', optional(rtpParameters));
        field('paused', boolean());

        rangeIndex('routerActive', ['routerId', 'id'])
            .withCondition((s) => s.state !== 'deleted');
        rangeIndex('transportActive', ['transportId', 'id'])
            .withCondition((s) => s.state !== 'deleted');
        rangeIndex('producerActive', ['producerId', 'id'])
            .withCondition((s) => s.state !== 'deleted');
    });

    //
    // Kitchen Queue
    //

    taskQueue('KitchenWorkerDelete');
    taskQueue('KitchenRouterCreate');
    taskQueue('KitchenRouterDelete');
    taskQueue('KitchenTransportCreate');
    taskQueue('KitchenTransportConnect');
    taskQueue('KitchenTransportDelete');
    taskQueue('KitchenProducerCreate');
    taskQueue('KitchenProducerDelete');
    taskQueue('KitchenConsumerCreate');
    taskQueue('KitchenConsumerUnpause');
    taskQueue('KitchenConsumerDelete');

    //
    // Kitchen Scallable
    //

    scalableStore();

    //
    // Experience
    //

    entity('UserEdge', () => {
        primaryKey('uid1', integer());
        primaryKey('uid2', integer());
        field('weight', optional(integer()));
        rangeIndex('forward', ['uid1', 'uid2']);
        rangeIndex('reverse', ['uid2', 'uid1']);
        rangeIndex('forwardWeight', ['uid1', 'weight']);
        rangeIndex('reverseWeight', ['uid2', 'weight']);
    });

    entity('UserGroupEdge', () => {
        primaryKey('uid', integer());
        primaryKey('cid', integer());
        field('weight', optional(integer()));
        rangeIndex('user', ['uid', 'weight']);
    });

    entity('UserInfluencerUserIndex', () => {
        primaryKey('uid', integer());
        field('value', integer());
    });

    entity('UserInfluencerIndex', () => {
        primaryKey('uid', integer());
        field('value', integer());
    });

    entity('UserBadge', () => {
        primaryKey('id', integer());
        field('uid', integer());
        field('name', string());
        field('verifiedBy', optional(integer()));
        field('deleted', optional(boolean()));
        rangeIndex('user', ['uid', 'id']).withCondition((src) => !src.deleted);
        rangeIndex('name', ['name', 'createdAt']);
    });

    entity('UserRoomBadge', () => {
        primaryKey('uid', integer());
        primaryKey('cid', integer());
        field('bid', optional(integer()));
        rangeIndex('chat', ['cid', 'uid']).withCondition((src) => !!src.bid);
        rangeIndex('user', ['uid', 'cid']).withCondition((src) => !!src.bid);
    });

    //
    // Shortnames
    //

    entity('ShortnameReservation', () => {
        primaryKey('shortname', string());
        field('ownerType', enumString('org', 'user', 'feed_channel', 'room', 'collection', 'hub'));
        field('ownerId', integer());
        field('enabled', boolean());
        uniqueIndex('user', ['ownerId']).withCondition((src) => src.ownerType === 'user' && src.enabled); // deprecated
        uniqueIndex('org', ['ownerId']).withCondition((src) => src.ownerType === 'org' && src.enabled);   // deprecated
        uniqueIndex('fromOwner', ['ownerType', 'ownerId']).withCondition((src) => src.enabled);
    });

    //
    // Notification Center
    //

    entity('NotificationCenter', () => {
        primaryKey('id', integer());
        field('kind', enumString('user'));
    });

    entity('UserNotificationCenter', () => {
        primaryKey('id', integer());
        field('uid', integer());
        uniqueIndex('user', ['uid']);
    });

    entity('Notification', () => {
        primaryKey('id', integer());
        field('ncid', integer());

        field('text', optional(string())).secure();

        field('deleted', optional(boolean()));

        field('content', optional(array(union({
            'new_comment': struct({
                commentId: integer(),
            }), 'new_matchmaking_profiles': struct({
                peerId: integer(), uids: array(integer()), peerType: string(),
            }), 'mention': struct({
                peerId: integer(), peerType: string(), messageId: integer(), messageType: string(),
            }),
        }))));

        rangeIndex('notificationCenter', ['ncid', 'id']).withCondition((src) => !src.deleted);
    });

    entity('NotificationCenterState', () => {
        primaryKey('ncid', integer());
        field('seq', integer());
        field('readNotificationId', optional(integer()));

        field('readSeq', optional(integer()));
        field('lastEmailNotification', optional(integer()));
        field('lastPushNotification', optional(integer()));
        field('lastEmailSeq', optional(integer()));
        field('lastPushSeq', optional(integer()));
    });

    entity('NotificationCenterEvent', () => {
        primaryKey('ncid', integer());
        primaryKey('seq', integer());
        field('notificationId', optional(integer()));
        field('updatedContent', optional(union({
            comment: struct({
                peerId: integer(), peerType: string(), commentId: optional(integer()),
            }),
        })));
        field('kind', enumString('notification_received', 'notification_read', 'notification_deleted', 'notification_updated', 'notification_content_updated'));

        rangeIndex('notificationCenter', ['ncid', 'seq']);
    });

    customDirectory('NotificationCenterNeedDeliveryFlag');

    entity('UserMessagingState', () => {
        primaryKey('uid', integer());
        field('seq', integer());
    });

    entity('UserNotificationsState', () => {
        primaryKey('uid', integer());
        field('lastEmailNotification', optional(integer()));
        field('lastPushNotification', optional(integer()));

        // DEPRECATED START
        field('readSeq', optional(integer()));
        field('lastEmailSeq', optional(integer()));
        field('lastPushSeq', optional(integer()));
        // DEPRECATED END

        field('lastEmailCursor', optional(string()));
        field('lastPushCursor', optional(string()));
    });

    customDirectory('NeedNotificationFlag');

    //
    // Feed
    //

    taskQueue('FeedAutoSubscription');
    taskQueue('FeedAutoSubscriptionMultiple');
    taskQueue('FeedDelivery');
    taskQueue('FeedDeliveryMultiple');
    taskQueue('FeedMentionNotification');

    entity('FeedSubscriber', () => {
        primaryKey('id', integer());
        field('key', string());
        uniqueIndex('key', ['key']);
    });

    entity('FeedSubscription', () => {
        primaryKey('sid', integer());
        primaryKey('tid', integer());
        field('enabled', boolean());

        rangeIndex('subscriber', ['sid', 'tid']).withCondition((state) => state.enabled);
        rangeIndex('topic', ['tid', 'sid']).withCondition((state) => state.enabled);
    });

    entity('FeedTopic', () => {
        primaryKey('id', integer());
        field('key', string());
        field('isGlobal', optional(boolean()));
        uniqueIndex('key', ['key']);
        rangeIndex('global', ['createdAt']).withCondition(src => src.isGlobal); // deprecated
        rangeIndex('fromGlobal', ['createdAt']).withCondition(src => src.isGlobal);
    });
    entity('FeedEvent', () => {
        primaryKey('id', integer());
        field('tid', integer());
        field('repeatKey', optional(string()));

        field('type', string());
        field('content', json());

        field('edited', optional(boolean()));
        field('deleted', optional(boolean()));

        rangeIndex('topic', ['tid', 'createdAt']);
        rangeIndex('fromTopic', ['tid', 'id']).withCondition(src => !src.deleted);
        rangeIndex('updated', ['updatedAt']);
        uniqueIndex('repeat', ['tid', 'repeatKey']).withCondition((src) => !!src.repeatKey);
    });

    event('FeedItemReceivedEvent', () => {
        field('subscriberId', optional(integer()));
        field('itemId', integer());
    });
    event('FeedItemUpdatedEvent', () => {
        field('subscriberId', optional(integer()));
        field('itemId', integer());
    });
    event('FeedItemDeletedEvent', () => {
        field('subscriberId', optional(integer()));
        field('itemId', integer());
    });
    event('FeedRebuildEvent', () => {
        field('subscriberId', optional(integer()));
    });

    eventStore('FeedEventStore', () => {
        primaryKey('subscriberId', integer());
    });
    eventStore('FeedGlobalEventStore', () => {
        // Noop
    });

    entity('FeedChannel', () => {
        primaryKey('id', integer());
        field('ownerId', integer());
        field('title', string());
        field('about', optional(string()));
        field('image', optional(ImageRef));
        field('socialImage', optional(ImageRef));
        field('type', optional(enumString('open', 'editorial', 'private')));
        field('isGlobal', optional(boolean()));
        field('isHidden', optional(boolean()));

        rangeIndex('owner', ['ownerId', 'id']).withCondition(src => !src.isHidden);
        rangeIndex('global', ['id', 'createdAt']).withCondition(src => !!src.isGlobal);
    });

    atomicInt('FeedChannelMembersCount', () => {
        primaryKey('channelId', integer());
    });

    atomicInt('FeedChannelPostsCount', () => {
        primaryKey('channelId', integer());
    });

    entity('FeedChannelAdmin', () => {
        primaryKey('channelId', integer());
        primaryKey('uid', integer());
        field('promoter', optional(integer()));
        field('role', enumString('creator', 'editor'));
        field('enabled', optional(boolean()));

        rangeIndex('channel', ['channelId', 'uid']).withCondition(src => !!src.enabled);
        rangeIndex('fromUser', ['uid', 'channelId']).withCondition(src => !!src.enabled);
    });

    entity('FeedChannelIndexingQueue', () => {
        primaryKey('id', integer());
        rangeIndex('updated', ['updatedAt']);
    });

    entity('UserFeedState', () => {
        primaryKey('uid', integer());
        field('draftsChannelId', optional(integer()));
    });

    entity('FeedChannelAutoSubscription', () => {
        primaryKey('channelId', integer());
        primaryKey('peerType', string());
        primaryKey('peerId', integer());
        field('uid', integer());
        field('enabled', boolean());
        rangeIndex('fromPeer', ['peerType', 'peerId', 'createdAt']).withCondition(src => src.enabled);
        rangeIndex('fromChannel', ['channelId', 'createdAt']).withCondition(src => src.enabled);
    });

    //
    // Counters
    //

    atomicInt('UserCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMessagesSentCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMessagesSentWeeklyCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMessagesSentInDirectChatTotalCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMessagesReceivedCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMessagesChatsCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMessagesChannelsCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMessagesDirectChatsCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserSuccessfulInvitesCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserSuccessfulInvitesPrevWeekCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserEmailSentCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserBrowserPushSentCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMobilePushSentCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserEmailSentWeeklyCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserBrowserPushSentWeeklyCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMobilePushSentWeeklyCounter', () => {
        primaryKey('uid', integer());
    });

    atomicInt('UserDialogCounter', () => {
        primaryKey('uid', integer());
        primaryKey('cid', integer());
    });
    atomicBool('UserDialogHaveMention', () => {
        primaryKey('uid', integer());
        primaryKey('cid', integer());
    });

    atomicInt('NotificationCenterCounter', () => {
        primaryKey('ncid', integer());
    });

    atomicInt('UserAudienceCounter', () => {
        primaryKey('uid', integer());
    });

    atomicInt('UserMessagesSentInDirectChatCounter', () => {
        primaryKey('uid', integer());
        primaryKey('cid', integer());
    });

    atomicInt('User2WayDirectChatsCounter', () => {
        primaryKey('uid', integer());
    });

    atomicInt('GlobalStatisticsCounters', () => {
        primaryKey('name', string());
    });

    // Global counters START
    atomicInt('UserGlobalCounterAllUnreadMessages', () => {
        primaryKey('uid', integer());
    });

    atomicInt('UserGlobalCounterUnreadMessagesWithoutMuted', () => {
        primaryKey('uid', integer());
    });

    atomicInt('UserGlobalCounterAllUnreadChats', () => {
        primaryKey('uid', integer());
    });

    atomicInt('UserGlobalCounterUnreadChatsWithoutMuted', () => {
        primaryKey('uid', integer());
    });
    // Global counters END

    atomicBool('UserHasFilledAbout', () => {
        primaryKey('uid', integer());
    });

    atomicInt('UserReactionsGot', () => {
        primaryKey('uid', integer());
    });

    atomicInt('UserReactionsGiven', () => {
        primaryKey('uid', integer());
    });

    atomicInt('StatsRecords', () => {
        primaryKey('metricName', string());
    });

    atomicInt('RoomMessagesCounter', () => {
        primaryKey('rid', integer());
    });
    atomicInt('RoomActiveMembersPrevWeekCounter', () => {
        primaryKey('rid', integer());
    });

    entity('ChatAudienceCalculatingQueue', () => {
        primaryKey('id', integer());
        field('active', boolean());
        field('delta', integer());
        rangeIndex('active', ['createdAt']).withCondition((src) => !!src.active);
    });

    //
    // Invites
    //

    entity('ChannelLink', () => {
        primaryKey('id', string());
        field('creatorId', integer());
        field('channelId', integer());
        field('enabled', boolean());
        rangeIndex('channel', ['channelId', 'createdAt']);
    });

    entity('AppInviteLink', () => {
        primaryKey('id', string());
        field('uid', integer());
        uniqueIndex('user', ['uid']);
    });

    entity('OrganizationPublicInviteLink', () => {
        primaryKey('id', string());
        field('uid', integer());
        field('oid', integer());
        field('enabled', boolean());
        uniqueIndex('userInOrganization', ['uid', 'oid']).withCondition(src => src.enabled);
    });

    entity('OrganizationInviteLink', () => {
        primaryKey('id', string());
        field('oid', integer());
        field('email', string());
        field('uid', integer());
        field('firstName', optional(string()));
        field('lastName', optional(string()));
        field('text', optional(string()));
        field('ttl', optional(integer()));
        field('enabled', optional(boolean()));
        field('joined', optional(boolean()));
        field('role', enumString('MEMBER', 'OWNER'));
        uniqueIndex('organization', ['oid', 'id']).withCondition(src => src.enabled);
        uniqueIndex('emailInOrganization', ['email', 'oid']).withCondition(src => src.enabled);
    });

    entity('ChannelInvitation', () => {
        primaryKey('id', string());
        field('creatorId', integer());
        field('channelId', integer());
        field('email', string());
        field('firstName', optional(string()));
        field('lastName', optional(string()));
        field('text', optional(string()));
        field('acceptedById', optional(integer()));
        field('enabled', optional(boolean()));
        rangeIndex('channel', ['createdAt', 'channelId']);
        rangeIndex('updated', ['updatedAt']);
    });

    //
    // Discover
    //

    entity('DiscoverUserPickedTags', () => {
        primaryKey('uid', integer());
        primaryKey('id', string());
        field('deleted', boolean());
        uniqueIndex('user', ['uid', 'id']).withCondition((src) => !src.deleted);
    });

    entity('DiscoverState', () => {
        primaryKey('uid', integer());
        field('skipped', boolean());
    });

    //
    // Onboarding
    //

    entity('UserOnboardingState', () => {
        primaryKey('uid', integer());
        field('wellcomeSent', optional(boolean()));
        field('askCompleteDeiscoverSent', optional(boolean()));
        field('askInviteSent', optional(boolean()));
        field('askInstallAppsSent', optional(boolean()));
        field('askSendFirstMessageSent', optional(boolean()));
    });

    //
    // Push
    //

    taskQueue('PushDelivery');

    entity('PushFirebase', () => {
        primaryKey('id', string());
        field('uid', integer());
        field('tid', string());
        field('token', string()).secure();
        field('packageId', string());
        field('sandbox', boolean());
        field('enabled', boolean());
        field('failures', optional(integer()));
        field('failedFirstAt', optional(integer()));
        field('failedLastAt', optional(integer()));
        field('disabledAt', optional(integer()));
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('token', ['token']).withCondition(src => src.enabled);
    });

    taskQueue('PushFirebaseDelivery');

    entity('PushApple', () => {
        primaryKey('id', string());
        field('uid', integer());
        field('tid', string());
        field('token', string()).secure();
        field('bundleId', string());
        field('sandbox', boolean());
        field('enabled', boolean());
        field('failures', optional(integer()));
        field('failedFirstAt', optional(integer()));
        field('failedLastAt', optional(integer()));
        field('disabledAt', optional(integer()));
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('token', ['token']).withCondition(src => src.enabled);
    });

    entity('PushSafari', () => {
        primaryKey('id', string());
        field('uid', integer());
        field('tid', string());
        field('token', string()).secure();
        field('bundleId', string());
        field('enabled', boolean());
        field('failures', optional(integer()));
        field('failedFirstAt', optional(integer()));
        field('failedLastAt', optional(integer()));
        field('disabledAt', optional(integer()));
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('token', ['token']).withCondition(src => src.enabled);
    });

    taskQueue('PushAppleDelivery');

    entity('PushWeb', () => {
        primaryKey('id', string());
        field('uid', integer());
        field('tid', string());
        field('endpoint', string()).secure();
        field('enabled', boolean());
        field('failures', optional(integer()));
        field('failedFirstAt', optional(integer()));
        field('failedLastAt', optional(integer()));
        field('disabledAt', optional(integer()));
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('endpoint', ['endpoint']).withCondition(src => src.enabled);
    });

    taskQueue('PushWebDelivery');

    //
    // Email
    //

    taskQueue('EmailSend');

    //
    // Apps
    //

    entity('AppHook', () => {
        primaryKey('appId', integer());
        primaryKey('chatId', integer());
        field('key', string());
        uniqueIndex('key', ['key']);
    });

    //
    // Stickers
    //

    entity('StickerPack', () => {
        primaryKey('id', integer());
        field('title', string());
        field('uid', integer());
        field('private', optional(boolean()));
        field('published', boolean());
        field('usesCount', integer());
        field('emojis', array(struct({
            emoji: string(), stickerId: string(),
        })));
        field('listed', optional(boolean()));

        rangeIndex('author', ['uid', 'id']);
        rangeIndex('listed', ['createdAt']).withCondition(a => a.listed);
    });

    entity('UserStickersState', () => {
        primaryKey('uid', integer());
        field('packIds', array(integer()));
        field('privatePackIds', optional(array(integer())));
        field('favoriteIds', array(string()));
        field('unviewedPackIds', optional(array(integer())));
    });

    entity('Sticker', () => {
        primaryKey('id', string());
        field('image', ImageRef);
        field('deleted', boolean());
        field('emoji', string());
        field('relatedEmojis', optional(array(string())));
        field('packId', integer());
        field('order', optional(integer()));
        rangeIndex('pack', ['packId', 'createdAt']);
        rangeIndex('packActive', ['packId', 'order']).withCondition((src) => !src.deleted);
    });

    eventStore('UserStickersEventStore', () => {
        primaryKey('uid', integer());
    });

    event('UserStickersUpdateEvent', () => {
        field('uid', integer());
    });

    atomicBool('StickerPackWasAdded', () => {
        primaryKey('uid', integer());
        primaryKey('pid', integer());
    });

    //
    // Matchmaking
    //

    let MatchmakingQuestion = union({
        text: struct({
            id: string(), title: string(), subtitle: optional(string()),
        }), multiselect: struct({
            id: string(), title: string(), subtitle: optional(string()), tags: array(string()),
        }),
    });

    entity('MatchmakingRoom', () => {
        primaryKey('peerId', integer());
        primaryKey('peerType', string());

        field('enabled', boolean());
        field('questions', array(MatchmakingQuestion));
    });

    entity('MatchmakingProfile', () => {
        primaryKey('peerId', integer());
        primaryKey('peerType', string());
        primaryKey('uid', integer());

        field('answers', optional(array(union({
            text: struct({
                question: MatchmakingQuestion, text: string(),
            }), multiselect: struct({
                question: MatchmakingQuestion, tags: array(string()),
            }),
        }))));

        rangeIndex('room', ['peerId', 'peerType', 'createdAt']);
    });

    //
    // Oauth
    //

    entity('OauthApplication', () => {
        primaryKey('id', integer());
        field('clientId', string());
        field('uid', integer());
        field('clientSecret', string());
        field('title', string());
        field('image', optional(ImageRef));
        field('allowedScopes', array(string()));
        field('allowedRedirectUrls', optional(array(string())));
        field('enabled', boolean());

        rangeIndex('user', ['uid', 'createdAt']);
        uniqueIndex('byClientId', ['clientId']);
    });

    entity('OauthContext', () => {
        primaryKey('id', string());
        field('clientId', string());
        // Provided by connected service
        field('state', string());
        // Provided by connected service
        field('redirectUrl', string());
        // Code generated by us, service will exchange it to token
        field('code', string());
        field('scopes', array(string()));
        field('enabled', boolean());
        field('uid', optional(integer()));

        uniqueIndex('fromCode', ['code']);
    });

    entity('OauthToken', () => {
        primaryKey('uuid', string());
        field('salt', string());
        field('uid', integer());
        field('clientId', string());
        field('enabled', optional(boolean()));
        field('scopes', array(string()));
        uniqueIndex('salt', ['salt']);
        rangeIndex('user', ['uid', 'uuid'])
            .withCondition(src => src.enabled !== false);
        rangeIndex('app', ['clientId', 'uuid'])
            .withCondition(src => src.enabled !== false);
    });

    //
    // Geo Location
    //
    const Geolocation = struct({
        lat: float(), long: float(),
    });

    // Store all user locations (with date index)
    entity('UserLocation', () => {
        primaryKey('uid', integer());
        field('isSharing', optional(boolean()));
        field('lastLocations', array(struct({
            date: integer(), location: Geolocation,
        })));
    });

    event('UserLocationUpdatedEvent', () => {
        field('uid', integer());
        field('date', integer());
    });

    event('UserLocationStopSharingEvent', () => {
        field('uid', integer());
    });

    eventStore('UserLocationEventStore', () => {
        primaryKey('uid', integer());
    });

    //
    // PowerUps
    //
    entity('Powerup', () => {
        primaryKey('id', integer());
        field('uid', optional(integer()));
        field('name', string());
        field('permissions', array(string()));
        field('image', optional(ImageRef));
        field('imageMonochrome', optional(ImageRef));
        field('description', optional(string()));
        field('deleted', boolean());
    });

    entity('ChatPowerup', () => {
        primaryKey('pid', integer());
        primaryKey('cid', integer());

        field('enabled', boolean());
        field('userSettings', json());

        rangeIndex('byPid', ['pid', 'createdAt']);
        rangeIndex('byCid', ['cid', 'createdAt']);
    });

    //
    // Permissions
    //
    entity('PermissionRequest', () => {
        primaryKey('id', string());

        field('uid', integer());
        field('gid', integer()); // group id
        field('appType', enumString('powerup')); // appplicant type
        field('appId', integer()); // applicant id
        field('scopeType', enumString('global', 'chat')); // scope type: global, chat, etc.
        field('scopeId', optional(integer())); // scope id (like chat)
        field('status', enumString('rejected', 'waiting', 'granted'));

        rangeIndex('user', ['uid', 'createdAt']);
        rangeIndex('userGroup', ['uid', 'gid', 'createdAt']);
        rangeIndex('groupApp', ['gid', 'appType', 'appId', 'createdAt']);
        rangeIndex('userApp', ['uid', 'appType', 'appId', 'createdAt']);
        uniqueIndex('single', ['uid', 'gid', 'appType', 'appId', 'scopeType', 'scopeId']);
    });

    //
    // User Storage
    //

    entity('UserStorageNamespace', () => {
        primaryKey('id', integer());
        field('ns', string());
        uniqueIndex('namespace', ['ns']);
    });

    entity('UserStorageRecord', () => {
        primaryKey('uid', integer());
        primaryKey('id', integer());
        field('ns', integer());
        field('key', string());
        field('value', optional(string()));
        uniqueIndex('key', ['uid', 'ns', 'key']);
    });

    //
    // Payment: Cards
    //

    entity('UserStripeCustomer', () => {
        primaryKey('uid', integer());
        field('uniqueKey', string());
        field('stripeId', optional(string()));
        uniqueIndex('stripe', ['stripeId']).withCondition((s) => !!s.stripeId);
    });

    entity('UserStripeCard', () => {
        primaryKey('uid', integer());
        primaryKey('pmid', string());

        // If Card is default payment method
        field('default', boolean());
        field('deleted', boolean());

        // Fields
        field('brand', string());
        field('country', string());
        field('exp_month', integer());
        field('exp_year', integer());
        field('last4', string());

        // Stripe Export
        field('stripeAttached', boolean());
        field('stripeDetached', boolean());

        // Make only one card default
        uniqueIndex('default', ['uid']).withCondition((s) => s.default);

        // Unique payment method id
        uniqueIndex('pmid', ['pmid']);

        // Range Index
        rangeIndex('users', ['uid', 'pmid']).withCondition((s) => !s.deleted);
    });

    //
    // Payments: Wallet
    //

    const PaymentReference = union({
        payment: struct({ id: string() }),
        paymentIntent: struct({ id: string() }),
        balance: struct({})
    });

    entity('Wallet', () => {
        primaryKey('uid', integer());
        field('balance', integer());
        field('balanceLocked', integer());
        field('isLocked', optional(boolean()));
    });

    entity('WalletTransaction', () => {
        primaryKey('id', string());
        field('uid', integer());
        field('status', enumString('pending', 'canceled', 'success'));
        field('parentId', optional(string()));
        field('deleted', optional(boolean()));

        field('operation', union({
            'deposit': struct({
                amount: integer(),
                payment: optional(string())
            }),
            'subscription': struct({
                chargeAmount: integer(),
                walletAmount: integer(),
                subscription: string(),
                index: integer()
            }),
            'transfer_out': struct({
                walletAmount: integer(),
                chargeAmount: integer(),
                toUser: integer(),
                payment: PaymentReference
            }),
            'transfer_in': struct({
                amount: integer(),
                fromUser: integer()
            }),
            'purchase': struct({
                walletAmount: integer(),
                chargeAmount: integer(),
                purchase: string(),
                payment: PaymentReference
            }),
            'income': struct({
                amount: integer(),
                source: enumString('subscription', 'purchase'),
                id: string()
            }),
        }));

        rangeIndex('pending', ['uid', 'createdAt']).withCondition((s) => !s.deleted && (s.status === 'pending' || s.status === 'canceling'));
        rangeIndex('history', ['uid', 'createdAt']).withCondition((s) => !s.deleted && !(s.status === 'pending' || s.status === 'canceling'));

        rangeIndex('pendingChild', ['parentId', 'createdAt']).withCondition((s) => s.status === 'pending');
    });

    entity('WalletDepositRequest', () => {
        primaryKey('uid', integer());
        primaryKey('retryKey', string());
        field('pid', string());
    });

    entity('WalletTransferRequest', () => {
        primaryKey('fromUid', integer());
        primaryKey('toUid', integer());
        primaryKey('retryKey', string());
        field('pid', optional(string()));
    });

    entity('WalletPurchase', () => {
        primaryKey('id', string());
        field('uid', integer());
        field('pid', optional(string()));
        field('txid', string());
        field('deleted', optional(boolean()));

        // Product
        field('amount', integer());
        field('product', union({
            'group': struct({
                gid: integer()
            }),
            'donate_message': struct({
                uid: integer(),
                cid: integer(),
                mid: optional(integer())
            }),
            'donate_reaction': struct({
                uid: integer(),
                mid: integer()
            })
        }));
        field('state', enumString('pending', 'canceled', 'success'));

        // Indexes
        rangeIndex('user', ['uid', 'createdAt']).withCondition((s) => !s.deleted);
        rangeIndex('userSuccess', ['uid', 'createdAt']).withCondition((s) => !s.deleted && s.state === 'success');
    });

    entity('WalletSubscription', () => {
        primaryKey('id', string());
        field('uid', integer());
        field('amount', integer());
        field('interval', enumString('week', 'month'));
        field('start', integer());
        field('proudct', union({
            'donate': struct({
                uid: integer()
            }),
            'group': struct({
                gid: integer()
            })
        }));

        field('state', enumString('started', 'grace_period', 'retrying', 'canceled', 'expired'));

        rangeIndex('active', ['id']).withCondition((s) => s.state !== 'expired');
        rangeIndex('user', ['uid', 'createdAt']);
    });

    entity('WalletSubscriptionScheduling', () => {
        primaryKey('id', string());
        field('currentPeriodIndex', integer());
    });

    entity('WalletSubscriptionPeriod', () => {
        primaryKey('id', string());
        primaryKey('index', integer());
        field('pid', optional(string()));
        field('start', integer());
        field('state', enumString('pending', 'failing', 'success', 'canceled'));
        field('needCancel', optional(boolean()));
        field('scheduledCancel', optional(boolean()));
        rangeIndex('pendingCancel', ['id']).withCondition((s) => s.needCancel && !s.scheduledCancel);
    });

    //
    // Payments: Payments
    //

    const PaymentIntentOperation = union({
        'deposit': struct({
            uid: integer()
        }),
        'payment': struct({
            id: string()
        }),
        'purchase': struct({
            id: string()
        })
    });

    const PaymentOperation = union({
        'deposit': struct({
            uid: integer(),
            txid: string()
        }),
        'subscription': struct({
            uid: integer(),
            subscription: string(),
            period: integer(),
            txid: string()
        }),
        'transfer': struct({
            fromUid: integer(),
            fromTx: string(),
            toUid: integer(),
            toTx: string(),
        }),
        'purchase': struct({
            id: string()
        })
    });

    entity('PaymentIntent', () => {
        primaryKey('id', string());
        field('state', enumString('pending', 'success', 'canceled'));
        field('amount', integer());
        field('operation', PaymentIntentOperation);
    });

    entity('Payment', () => {
        primaryKey('id', string());
        field('uid', integer());
        field('amount', integer());
        field('state', enumString('pending', 'success', 'action_required', 'failing', 'canceled'));
        field('operation', PaymentOperation);

        field('piid', optional(string()));
        rangeIndex('user', ['uid', 'createdAt']);
        rangeIndex('pending', ['id']).withCondition((s) => s.state === 'pending' || s.state === 'failing');
        rangeIndex('userFailing', ['uid', 'createdAt']).withCondition((s) => s.state === 'failing' || s.state === 'action_required');
    });

    entity('PaymentScheduling', () => {
        primaryKey('id', string());
        field('attempt', integer());
        field('failuresCount', integer());
        field('lastFailureDate', optional(integer()));
        field('inProgress', boolean());
    });

    //
    // Payments: Updates
    //

    eventStore('UserWalletUpdates', () => {
        primaryKey('uid', integer());
    });

    event('WalletTransactionPending', () => {
        field('id', string());
    });
    event('WalletTransactionSuccess', () => {
        field('id', string());
    });
    event('WalletTransactionCanceled', () => {
        field('id', string());
    });
    event('PaymentStatusChanged', () => {
        field('id', string());
    });
    event('WalletBalanceChanged', () => {
        field('amount', integer());
    });
    event('WalletLockedChanged', () => {
        field('isLocked', boolean());
        field('failingPaymentsCount', integer());
    });

    //
    // Payments: Stripe Events
    //

    entity('StripeEventsCursor', () => {
        primaryKey('id', string());
        field('cursor', string());
    });

    entity('StripeEvent', () => {
        primaryKey('id', string());
        field('type', string());
        field('data', json());
        field('date', integer());
        field('liveMode', boolean());
    });

    //
    // Payments: Stripe Event Store
    //

    eventStore('StripeEventStore', () => {
        primaryKey('liveMode', boolean());
    });

    event('StripeEventCreated', () => {
        field('id', string());
        field('eventType', string());
        field('eventDate', integer());
    });

    //
    // Events
    //

    customDirectory('EventStorage');
    customDirectory('EventRegistrations');

    // Events

    defineEvents();

    //
    // System
    //

    entity('Sequence', () => {
        primaryKey('sequence', string());
        field('value', integer());
    });

    entity('Environment', () => {
        primaryKey('production', integer());
        field('comment', string());
    });

    entity('EnvironmentVariable', () => {
        primaryKey('name', string());
        field('value', string());
    });

    entity('ServiceCache', () => {
        primaryKey('service', string());
        primaryKey('key', string());
        field('value', optional(string()));
        rangeIndex('fromService', ['service', 'key']);
    });

    entity('ReaderState', () => {
        primaryKey('id', string());
        field('cursor', string());
        field('version', optional(integer()));
    });
    atomicInt('ReaderEstimate', () => {
        primaryKey('id', string());
    });

    entity('SuperAdmin', () => {
        primaryKey('id', integer());
        field('role', string());
        field('enabled', boolean());
    });

    entity('AuthToken', () => {
        primaryKey('uuid', string());
        field('salt', string());
        field('uid', integer());
        field('lastIp', string());
        field('platform', optional(string()));
        field('enabled', optional(boolean()));
        field('language', optional(enumString('RU', 'EN')));
        uniqueIndex('salt', ['salt']);
        rangeIndex('user', ['uid', 'uuid'])
            .withCondition(src => src.enabled !== false);
    });

    entity('AuthCodeSession', () => {
        primaryKey('uid', string());
        field('code', string()).secure();
        field('expires', integer());
        field('attemptsCount', optional(integer()));
        field('email', string());
        field('tokenId', optional(string())).secure();
        field('enabled', boolean());
    });

    // Deprecated
    atomicInt('LastAuthEmailSentTime', () => {
        primaryKey('email', string());
    });

    // Deprecated
    atomicInt('AuthEmailsSentCount', () => {
        primaryKey('email', string());
    });

    entity('FeatureFlag', () => {
        primaryKey('key', string());
        field('title', string());
    });

    entity('OrganizationFeatures', () => {
        primaryKey('id', string());
        field('featureKey', string());
        field('organizationId', integer());
        field('enabled', boolean());
        uniqueIndex('organization', ['organizationId', 'featureKey']);
    });

    eventStore('HyperLogStore', () => {
        //
    });

    event('HyperLogEvent', () => {
        field('id', string());
        field('eventType', string());
        field('date', integer());
        field('body', json());
    });

    event('HyperLogUserEvent', () => {
        field('id', string());
        field('eventType', string());
        field('date', integer());
        field('body', json());
    });

    entity('Task', () => {
        primaryKey('taskType', string());
        primaryKey('uid', string());

        field('arguments', json());
        field('result', json());
        field('startAt', optional(integer()));
        field('taskStatus', enumString('pending', 'executing', 'failing', 'failed', 'completed'));

        field('taskMaxFailureCount', optional(integer()));
        field('taskFailureCount', optional(integer()));
        field('taskFailureTime', optional(integer()));
        field('taskLockSeed', optional(string()));
        field('taskLockTimeout', optional(integer()));
        field('taskFailureMessage', optional(string()));

        rangeIndex('pending', ['taskType', 'createdAt'])
            .withCondition((src) => src.taskStatus === 'pending' && !src.startAt);
        rangeIndex('delayedPending', ['taskType', 'startAt'])
            .withCondition((src) => src.taskStatus === 'pending' && !!src.startAt);
        rangeIndex('executing', ['taskLockTimeout'])
            .withCondition((src) => src.taskStatus === 'executing');
        rangeIndex('failing', ['taskFailureTime'])
            .withCondition((src) => src.taskStatus === 'failing');

        allowDelete();
    });

    entity('DelayedTask', () => {
        primaryKey('taskType', string());
        primaryKey('uid', string());

        field('delay', integer());
        field('arguments', json());
        field('result', optional(json()));
        field('taskStatus', enumString('pending', 'executing', 'failing', 'failed', 'completed'));

        field('taskFailureTime', optional(integer()));
        field('taskFailureMessage', optional(string()));

        rangeIndex('pending', ['taskType', 'delay'])
            .withCondition((src) => src.taskStatus === 'pending');
        rangeIndex('failing', ['taskFailureTime'])
            .withCondition((src) => src.taskStatus === 'failing');
    });

    entity('ServiceThrottle', () => {
        primaryKey('service', string());
        primaryKey('key', string());

        field('lastFireTime', integer());
        field('firedCount', integer());
    });

    entity('OneTimeCode', () => {
        primaryKey('service', string());
        primaryKey('id', string());
        field('code', string()).secure();
        field('expires', integer());
        field('attemptsCount', integer());
        field('data', json());
        field('enabled', boolean());

        // uniqueIndex('code', ['service', 'code']).withCondition((src) => !!src.enabled);
    });

    //
    // Sharding
    //

    customDirectory('ShardingData');

    //
    //  Debug
    //

    entity('DebugEvent', () => {
        primaryKey('uid', integer());
        primaryKey('seq', integer());
        field('key', optional(string()));
        rangeIndex('user', ['uid', 'seq']);
    });

    entity('DebugEventState', () => {
        primaryKey('uid', integer());
        field('seq', integer());
    });

    entity('EntityCounterState', () => {
        primaryKey('id', string());
        field('cursor', optional(string())); // deprecated
        field('lastId', optional(json()));
        field('count', integer());
        field('version', optional(integer()));
    });

    entity('GqlTrace', () => {
        primaryKey('id', integer());
        field('traceData', json());
        rangeIndex('trace', ['id']);
    });

    entity('EntityCleanerState', () => {
        primaryKey('id', string());
        field('lastId', optional(json()));
        field('deletedCount', integer());
        field('brokenRecordsCount', optional(integer()));
        field('version', optional(integer()));
    });

    //
    // Discover 2.0
    //
    entity('EditorsChoiceChatsCollection', () => {
        primaryKey('id', integer());
        field('createdBy', integer());
        field('title', string());
        field('description', optional(string()));
        field('image', ImageRef);
        field('chatIds', array(integer()));
        field('deleted', optional(boolean()));

        rangeIndex('collection', ['id']).withCondition((src) => !src.deleted);
        rangeIndex('created', ['id', 'createdAt']).withCondition((src) => !src.deleted);
    });
    entity('EditorsChoiceChat', () => {
        primaryKey('id', integer());
        field('createdBy', integer());
        field('image', ImageRef);
        field('cid', integer());
        field('deleted', optional(boolean()));

        uniqueIndex('all', ['id']).withCondition((src) => !src.deleted);
    });

    //
    // Clickhouse Migrations
    //

    entity('ClickHouseMigrations', () => {
        primaryKey('version', integer());
        field('applied', array(string()));
    });

    discussionsStore();
    contactsStore();
    phoneBookStore();
    blackListStore();
});
