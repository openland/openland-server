import { declareSchema, atomicInt, primaryKey, atomicBool, integer, entity, field, string, optional, boolean, rangeIndex, uniqueIndex, enumString, json, struct, customDirectory, array, union } from '@openland/foundationdb-compiler';

export default declareSchema(() => {

    //
    // User
    //

    entity('User', () => {
        primaryKey('id', integer());
        field('authId', string());
        field('email', string());
        field('isBot', boolean());
        field('invitedBy', optional(integer()));
        field('botOwner', optional(integer()));
        field('isSuperBot', optional(boolean()));
        field('status', enumString('pending', 'activated', 'suspended', 'deleted'));

        uniqueIndex('authId', ['authId']).withCondition(src => src.status !== 'deleted');
        uniqueIndex('email', ['email']).withCondition(src => src.status !== 'deleted');
        rangeIndex('owner', ['botOwner', 'id']).withCondition(src => src.botOwner);
        rangeIndex('superBots', []).withCondition(src => src.isBot === true && src.isSuperBot);
    });

    entity('UserProfile', () => {
        primaryKey('id', integer());
        field('firstName', string());
        field('lastName', optional(string()));
        field('phone', optional(string()));
        field('about', optional(string()));
        field('website', optional(string()));
        field('location', optional(string()));
        field('email', optional(string()));
        field('picture', optional(json()));
        field('linkedin', optional(string()));
        field('twitter', optional(string()));
        field('locations', optional(json()));
        field('primaryOrganization', optional(integer()));
        field('primaryBadge', optional(integer()));
        field('role', optional(string()));
        rangeIndex('byUpdatedAt', ['updatedAt']);
    });

    entity('UserProfilePrefil', () => {
        primaryKey('id', integer());
        field('firstName', optional(string()));
        field('lastName', optional(string()));
        field('picture', optional(string()));
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
    });

    entity('UserIndexingQueue', () => {
        primaryKey('id', integer());
        rangeIndex('updated', ['updatedAt']);
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
        rangeIndex('community', []).withCondition((src) => src.kind === 'community' && src.status === 'activated');
    });

    entity('OrganizationProfile', () => {
        primaryKey('id', integer());
        field('name', string());
        field('photo', optional(struct({
            uuid: string(),
            crop: optional(struct({
                x: integer(),
                y: integer(),
                w: integer(),
                h: integer()
            }))
        })));
        field('about', optional(string()));
        field('twitter', optional(string()));
        field('facebook', optional(string()));
        field('linkedin', optional(string()));
        field('website', optional(string()));

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

    //
    // Messaging
    //

    entity('MessageDraft', () => {
        primaryKey('uid', integer());
        primaryKey('cid', integer());
        field('contents', optional(string()));
    });

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

    //
    // Conference
    //

    entity('ConferenceRoom', () => {
        primaryKey('id', integer());
        field('startTime', optional(integer()));
        field('strategy', optional(enumString('direct', 'bridged')));
    });

    entity('ConferencePeer', () => {
        primaryKey('id', integer());
        field('cid', integer());
        field('uid', integer());
        field('tid', string());
        field('keepAliveTimeout', integer());
        field('enabled', boolean());
        uniqueIndex('auth', ['cid', 'uid', 'tid']).withCondition((src) => src.enabled);
        rangeIndex('conference', ['cid', 'keepAliveTimeout']).withCondition((src) => src.enabled);
        rangeIndex('active', ['keepAliveTimeout']).withCondition((src) => src.enabled);
    });

    entity('ConferenceMediaStream', () => {
        primaryKey('id', integer());
        field('cid', integer());
        field('peer1', integer());
        field('peer2', optional(integer()));
        field('kind', enumString('direct', 'bridged'));
        field('state', enumString('wait-offer', 'wait-answer', 'online', 'completed'));
        field('offer', optional(string()));
        field('answer', optional(string()));
        field('ice1', json());
        field('ice2', json());
        rangeIndex('conference', ['cid', 'createdAt']).withCondition((src) => src.state !== 'completed');
    });

    entity('ConferenceConnection', () => {
        primaryKey('peer1', integer());
        primaryKey('peer2', integer());
        field('cid', integer());
        field('state', enumString('wait-offer', 'wait-answer', 'online', 'completed'));
        field('offer', optional(string()));
        field('answer', optional(string()));
        field('ice1', json());
        field('ice2', json());
        rangeIndex('conference', ['cid', 'createdAt']).withCondition((src) => src.state !== 'completed');
    });

    //
    // Experience
    //

    entity('UserEdge', () => {
        primaryKey('uid1', integer());
        primaryKey('uid2', integer());
        rangeIndex('forward', ['uid1', 'uid2']);
        rangeIndex('reverse', ['uid2', 'uid1']);
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
        field('ownerType', enumString('org', 'user'));
        field('ownerId', integer());
        field('enabled', boolean());
        uniqueIndex('user', ['ownerId']).withCondition((src) => src.ownerType === 'user' && src.enabled);
        uniqueIndex('org', ['ownerId']).withCondition((src) => src.ownerType === 'org' && src.enabled);
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
                commentId: integer()
            })
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
                peerId: integer(),
                peerType: string(),
                commentId: optional(integer())
            })
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
        field('readSeq', optional(integer()));
        field('lastEmailNotification', optional(integer()));
        field('lastPushNotification', optional(integer()));
        field('lastEmailSeq', optional(integer()));
        field('lastPushSeq', optional(integer()));
    });

    customDirectory('NeedNotificationFlag');

    //
    // Feed
    //

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
        uniqueIndex('key', ['key']);
    });
    entity('FeedEvent', () => {
        primaryKey('id', integer());
        field('tid', integer());

        field('type', string());
        field('content', json());

        rangeIndex('topic', ['tid', 'createdAt']);
        rangeIndex('updated', ['updatedAt']);
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
    atomicInt('UserMessagesSentInDirectChatTotalCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMessagesReceivedCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMessagesChatsCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserMessagesDirectChatsCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserSuccessfulInvitesCounter', () => {
        primaryKey('uid', integer());
    });
    atomicInt('UserEmailSentCounter', () => {
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
    // Onboarding
    //

    entity('DiscoverUserPickedTags', () => {
        primaryKey('uid', integer());
        primaryKey('id', string());
        field('deleted', boolean());
        uniqueIndex('user', ['uid', 'id']).withCondition((src) => !src.deleted);
    });

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
        field('enabled', optional(boolean()));
        uniqueIndex('salt', ['salt']);
        rangeIndex('user', ['uid', 'uuid'])
            .withCondition(src => src.enabled !== false);
    });

    entity('AuthCodeSession', () => {
        primaryKey('uid', string());
        field('code', string()).secure();
        field('expires', integer());
        field('email', string());
        field('tokenId', optional(string())).secure();
        field('enabled', boolean());
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

    entity('HyperLog', () => {
        primaryKey('id', string());
        field('type', string());
        field('date', integer());
        field('body', json());
        rangeIndex('created', ['createdAt']);
        rangeIndex('userEvents', ['createdAt']).withCondition((src) => src.type === 'track');
        rangeIndex('onlineChangeEvents', ['createdAt']).withCondition((src) => src.type === 'online_status');
    });

    entity('Task', () => {
        primaryKey('taskType', string());
        primaryKey('uid', string());

        field('arguments', json());
        field('result', json());
        field('startAt', integer());
        field('taskStatus', enumString('pending', 'executing', 'failing', 'failed', 'completed'));

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
        // rangeIndex('executing', ['taskLockTimeout'])
        //     .withCondition((src) => src.taskStatus === 'executing');
        rangeIndex('failing', ['taskFailureTime'])
            .withCondition((src) => src.taskStatus === 'failing');
    });

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
});