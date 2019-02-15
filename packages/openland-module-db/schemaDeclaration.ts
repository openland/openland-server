import { generate } from '../foundation-orm-gen/generate';
import {
    declareSchema,
    entity,
    field,
    primaryKey,
    enableTimestamps,
    enableVersioning,
    enumField,
    rangeIndex,
    uniqueIndex,
    allowAdminEdit,
    jsonField
} from '../foundation-orm-gen';
import { jField, jNumber, json, jString } from '../openland-utils/jsonSchema';

const Schema = declareSchema(() => {

    entity('Environment', () => {
        primaryKey('production', 'number');
        field('comment', 'string');
        allowAdminEdit();
    });

    entity('Online', () => {
        primaryKey('uid', 'number');
        field('lastSeen', 'number');
        field('active', 'boolean').nullable();
    });

    entity('Presence', () => {
        primaryKey('uid', 'number');
        primaryKey('tid', 'string');
        field('lastSeen', 'number');
        field('lastSeenTimeout', 'number');
        field('platform', 'string');
    });

    entity('AuthToken', () => {
        primaryKey('uuid', 'string');
        field('salt', 'string');
        field('uid', 'number');
        field('lastIp', 'string');
        field('enabled', 'boolean').nullable();
        uniqueIndex('salt', ['salt'])
            .withDisplayName('authTokenBySalt');
        rangeIndex('user', ['uid', 'uuid'])
            .withCondition(src => src.enabled !== false);
        enableTimestamps();
        enableVersioning();
    });

    entity('ServiceCache', () => {
        primaryKey('service', 'string');
        primaryKey('key', 'string');
        field('value', 'string');
        enableTimestamps();
        enableVersioning();
    });

    entity('Lock', () => {
        primaryKey('key', 'string');
        field('seed', 'string');
        field('timeout', 'number');
        field('version', 'number');
        field('minVersion', 'number');
    });

    entity('Task', () => {
        primaryKey('taskType', 'string');
        primaryKey('uid', 'string');

        field('arguments', 'json');
        field('result', 'json').nullable();
        enumField('taskStatus', ['pending', 'executing', 'failing', 'failed', 'completed']);

        field('taskFailureCount', 'number').nullable();
        field('taskFailureTime', 'number').nullable();
        field('taskLockSeed', 'string').nullable();
        field('taskLockTimeout', 'number').nullable();
        field('taskFailureMessage', 'string').nullable();

        rangeIndex('pending', ['taskType', 'createdAt'])
            .withCondition((src) => src.taskStatus === 'pending')
            .withDisplayName('tasksPending');
        rangeIndex('executing', ['taskLockTimeout'])
            .withCondition((src) => src.taskStatus === 'executing')
            .withDisplayName('tasksExecuting');
        rangeIndex('failing', ['taskFailureTime'])
            .withCondition((src) => src.taskStatus === 'failing')
            .withDisplayName('tasksFailing');

        enableTimestamps();
        enableVersioning();
    });

    //
    //  Pushes
    //

    entity('PushFirebase', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('tid', 'string');
        field('token', 'string').secure();
        field('packageId', 'string');
        field('sandbox', 'boolean');
        field('enabled', 'boolean');
        field('failures', 'number').nullable();
        field('failedFirstAt', 'number').nullable();
        field('failedLastAt', 'number').nullable();
        field('disabledAt', 'number').nullable();
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('token', ['token']).withCondition(src => src.enabled);
        enableTimestamps();
        enableVersioning();
    });

    entity('PushApple', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('tid', 'string');
        field('token', 'string').secure();
        field('bundleId', 'string');
        field('sandbox', 'boolean');
        field('enabled', 'boolean');
        field('failures', 'number').nullable();
        field('failedFirstAt', 'number').nullable();
        field('failedLastAt', 'number').nullable();
        field('disabledAt', 'number').nullable();
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('token', ['token']).withCondition(src => src.enabled);
        enableTimestamps();
        enableVersioning();
    });

    entity('PushWeb', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('tid', 'string');
        field('endpoint', 'string').secure();
        field('enabled', 'boolean');
        field('failures', 'number').nullable();
        field('failedFirstAt', 'number').nullable();
        field('failedLastAt', 'number').nullable();
        field('disabledAt', 'number').nullable();
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('endpoint', ['endpoint']).withCondition(src => src.enabled);
        enableTimestamps();
        enableVersioning();
    });

    entity('PushSafari', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('tid', 'string');
        field('token', 'string').secure();
        field('bundleId', 'string');
        field('enabled', 'boolean');
        field('failures', 'number').nullable();
        field('failedFirstAt', 'number').nullable();
        field('failedLastAt', 'number').nullable();
        field('disabledAt', 'number').nullable();
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('token', ['token']).withCondition(src => src.enabled);
        enableTimestamps();
        enableVersioning();
    });

    entity('UserProfilePrefil', () => {
        primaryKey('id', 'number');
        field('firstName', 'string').nullable();
        field('lastName', 'string').nullable();
        field('picture', 'string').nullable();
        enableTimestamps();
        enableVersioning();
    });

    entity('User', () => {
        primaryKey('id', 'number');
        field('authId', 'string');
        field('email', 'string');
        field('isBot', 'boolean');
        field('invitedBy', 'number').nullable();
        field('botOwner', 'number').nullable();
        enumField('status', ['pending', 'activated', 'suspended', 'deleted']);

        uniqueIndex('authId', ['authId']).withCondition(src => src.status !== 'deleted');
        uniqueIndex('email', ['email']).withCondition(src => src.status !== 'deleted');
        rangeIndex('owner', ['botOwner', 'id']).withCondition(src => src.botOwner);
    });

    entity('UserProfile', () => {
        primaryKey('id', 'number');
        field('firstName', 'string');
        field('lastName', 'string').nullable();
        field('phone', 'string').nullable();
        field('about', 'string').nullable();
        field('website', 'string').nullable();
        field('location', 'string').nullable();
        field('email', 'string').nullable();
        field('picture', 'json').nullable();
        field('linkedin', 'string').nullable();
        field('twitter', 'string').nullable();
        field('locations', 'json').nullable();
        field('primaryOrganization', 'number').nullable();
        field('role', 'string').nullable();
        rangeIndex('byUpdatedAt', ['updatedAt']);
        enableTimestamps();
        enableVersioning();
    });

    entity('UserIndexingQueue', () => {
        primaryKey('id', 'number');
        rangeIndex('updated', ['updatedAt']);
        enableTimestamps();
        enableVersioning();
    });

    entity('Organization', () => {
        primaryKey('id', 'number');
        field('ownerId', 'number');
        enumField('status', ['pending', 'activated', 'suspended', 'deleted']);
        enumField('kind', ['organization', 'community']);
        field('editorial', 'boolean');
        enableTimestamps();
        enableVersioning();
    });

    entity('OrganizationProfile', () => {
        primaryKey('id', 'number');
        field('name', 'string');
        jsonField('photo', () => {
            jField('uuid', jString());
            jField('crop', json(() => {
                jField('x', jNumber());
                jField('y', jNumber());
                jField('w', jNumber());
                jField('h', jNumber());
            }), true);
        }).nullable();
        field('about', 'string').nullable();
        field('twitter', 'string').nullable();
        field('facebook', 'string').nullable();
        field('linkedin', 'string').nullable();
        field('website', 'string').nullable();
        enableTimestamps();
        enableVersioning();
    });

    entity('OrganizationEditorial', () => {
        primaryKey('id', 'number');
        field('listed', 'boolean');
        field('featured', 'boolean');
        enableTimestamps();
        enableVersioning();
    });

    entity('OrganizationIndexingQueue', () => {
        primaryKey('id', 'number');
        rangeIndex('updated', ['updatedAt']);
        enableTimestamps();
        enableVersioning();
    });

    entity('OrganizationMember', () => {
        primaryKey('oid', 'number');
        primaryKey('uid', 'number');
        field('invitedBy', 'number').nullable();
        enumField('role', ['admin', 'member']);
        enumField('status', ['requested', 'joined', 'left']);

        uniqueIndex('ids', ['oid', 'uid']);
        rangeIndex('organization', ['status', 'oid', 'uid']).withDisplayName('usersFromOrganization');
        rangeIndex('user', ['status', 'uid', 'oid']).withDisplayName('organizationsFromUser');

        enableTimestamps();
        enableVersioning();
    });

    entity('FeatureFlag', () => {
        primaryKey('key', 'string');
        field('title', 'string');
        enableTimestamps();
        enableVersioning();
    });

    entity('OrganizationFeatures', () => {
        primaryKey('id', 'string');
        field('featureKey', 'string');
        field('organizationId', 'number');
        field('enabled', 'boolean');
        uniqueIndex('organization', ['organizationId', 'featureKey']).withRange();
        enableTimestamps();
        enableVersioning();
    });

    entity('ReaderState', () => {
        primaryKey('id', 'string');
        field('cursor', 'string');
        field('version', 'number').nullable();
        enableVersioning();
        enableTimestamps();
    });

    entity('SuperAdmin', () => {
        primaryKey('id', 'number');
        field('role', 'string');
        field('enabled', 'boolean');
    });

    entity('UserSettings', () => {
        primaryKey('id', 'number');
        enumField('emailFrequency', ['1hour', '15min', 'never', '24hour', '1week']);
        enumField('desktopNotifications', ['all', 'direct', 'none']);
        enumField('mobileNotifications', ['all', 'direct', 'none']);
        field('mobileAlert', 'boolean').nullable();
        field('mobileIncludeText', 'boolean').nullable();
        enumField('notificationsDelay', ['none', '1min', '15min']).nullable();
        enableVersioning();
        enableTimestamps();
    });

    entity('ShortnameReservation', () => {
        primaryKey('shortname', 'string');
        enumField('ownerType', ['org', 'user']);
        field('ownerId', 'number');
        field('enabled', 'boolean');
        uniqueIndex('user', ['ownerId']).withCondition((src) => src.ownerType === 'user' && src.enabled);
        uniqueIndex('org', ['ownerId']).withCondition((src) => src.ownerType === 'org' && src.enabled);
        enableVersioning();
        enableTimestamps();
    });

    entity('AuthCodeSession', () => {
        primaryKey('uid', 'string');
        field('code', 'string').secure();
        field('expires', 'number');
        field('email', 'string');
        field('tokenId', 'string').nullable().secure();
        field('enabled', 'boolean');
        enableVersioning();
        enableTimestamps();
    });

    //
    // Conversation
    //

    entity('Conversation', () => {
        primaryKey('id', 'number');
        enumField('kind', ['private', 'organization', 'room']);
        enableVersioning();
        enableTimestamps();
    });

    entity('ConversationPrivate', () => {
        primaryKey('id', 'number');
        field('uid1', 'number');
        field('uid2', 'number');
        uniqueIndex('users', ['uid1', 'uid2']);
        enableVersioning();
        enableTimestamps();
    });

    entity('ConversationOrganization', () => {
        primaryKey('id', 'number');
        field('oid', 'number');
        uniqueIndex('organization', ['oid']);
        enableVersioning();
        enableTimestamps();
    });

    entity('ConversationRoom', () => {
        primaryKey('id', 'number');
        enumField('kind', ['organization', 'internal', 'public', 'group']);
        field('oid', 'number').nullable();
        field('ownerId', 'number').nullable();
        field('featured', 'boolean').nullable();
        field('listed', 'boolean').nullable();
        rangeIndex('organization', ['oid'])
            .withCondition((v) => v.kind === 'public' || v.kind === 'internal');
        uniqueIndex('organizationPublicRooms', ['oid', 'id'])
            .withCondition((v) => v.kind === 'public')
            .withRange();
        enableVersioning();
        enableTimestamps();
    });

    entity('RoomProfile', () => {
        primaryKey('id', 'number');

        field('title', 'string');
        field('image', 'json').nullable();
        field('description', 'string').nullable();
        field('socialImage', 'json').nullable();

        rangeIndex('updated', ['updatedAt']);
        enableVersioning();
        enableTimestamps();
    });

    entity('RoomParticipant', () => {
        primaryKey('cid', 'number');
        primaryKey('uid', 'number');
        field('invitedBy', 'number');
        enumField('role', ['member', 'admin', 'owner']);
        enumField('status', ['joined', 'requested', 'left', 'kicked']);
        uniqueIndex('active', ['cid', 'uid']).withCondition((src) => src.status === 'joined').withRange();
        uniqueIndex('requests', ['cid', 'uid']).withCondition((src) => src.status === 'requested').withRange();
        uniqueIndex('userActive', ['uid', 'cid']).withCondition((src) => src.status === 'joined').withRange();
        enableVersioning();
        enableTimestamps();
    });

    entity('ConversationReceiver', () => {
        primaryKey('cid', 'number');
        primaryKey('uid', 'number');
        field('enabled', 'boolean');
        uniqueIndex('conversation', ['cid', 'uid']).withCondition((src) => src.enabled);
        enableVersioning();
        enableTimestamps();
    });

    //
    // Conversation State
    //

    entity('Sequence', () => {
        primaryKey('sequence', 'string');
        field('value', 'number');
    });

    entity('Message', () => {
        primaryKey('id', 'number');
        field('cid', 'number');
        field('uid', 'number');
        field('repeatKey', 'string').nullable();

        field('text', 'string').nullable().secure();
        field('fileId', 'string').nullable().secure();
        field('fileMetadata', 'json').nullable().secure();
        field('filePreview', 'string').nullable().secure();
        field('mentions', 'json').nullable();
        field('replyMessages', 'json').nullable();
        field('augmentation', 'json').nullable();
        field('serviceMetadata', 'json').nullable();
        field('reactions', 'json').nullable().secure();
        field('edited', 'boolean').nullable();
        field('attachments', 'json').nullable();
        field('buttons', 'json').nullable();
        field('type', 'string').nullable();
        field('title', 'string').nullable();
        field('postType', 'string').nullable();
        field('complexMentions', 'json').nullable();

        field('isMuted', 'boolean');
        field('isService', 'boolean');
        field('deleted', 'boolean').nullable();
        rangeIndex('chat', ['cid', 'id']).withCondition((src) => !src.deleted);
        rangeIndex('updated', ['updatedAt']);
        uniqueIndex('repeat', ['uid', 'cid', 'repeatKey']).withCondition((src) => !!src.repeatKey);
        enableVersioning();
        enableTimestamps();
    });

    entity('ConversationSeq', () => {
        primaryKey('cid', 'number');
        field('seq', 'number');
    });

    entity('ConversationEvent', () => {
        primaryKey('cid', 'number');
        primaryKey('seq', 'number');
        field('uid', 'number').nullable();
        field('mid', 'number').nullable();
        enumField('kind', ['message_received', 'message_updated', 'message_deleted']);
        rangeIndex('user', ['cid', 'seq']).withStreaming();
        enableVersioning();
        enableTimestamps();
    });

    //
    // User Messaging state
    //

    entity('UserDialog', () => {
        primaryKey('uid', 'number');
        primaryKey('cid', 'number');
        field('unread', 'number');
        field('readMessageId', 'number').nullable();
        field('date', 'number').nullable();
        field('haveMention', 'boolean').nullable();

        field('title', 'string').nullable();
        field('photo', 'json').nullable();

        rangeIndex('user', ['uid', 'date'])
            .withCondition((src) => !!src.date)
            .withDisplayName('dialogsForUser');
        uniqueIndex('conversation', ['cid', 'uid'])
            .withRange();
        rangeIndex('updated', ['updatedAt']);
        enableTimestamps();
        enableVersioning();
    });

    entity('UserDialogHandledMessage', () => {
        primaryKey('uid', 'number');
        primaryKey('cid', 'number');
        primaryKey('mid', 'number');
        enableTimestamps();
        enableVersioning();
    });

    entity('UserDialogSettings', () => {
        primaryKey('uid', 'number');
        primaryKey('cid', 'number');
        field('mute', 'boolean');
        enableTimestamps();
        enableVersioning();
    });

    entity('UserDialogEvent', () => {
        primaryKey('uid', 'number');
        primaryKey('seq', 'number');
        field('cid', 'number').nullable();
        field('mid', 'number').nullable();
        field('allUnread', 'number').nullable();
        field('unread', 'number').nullable();
        field('title', 'string').nullable();
        field('photo', 'json').nullable();
        field('mute', 'boolean').nullable();
        field('haveMention', 'boolean').nullable();
        enumField('kind', ['message_received', 'message_updated', 'message_deleted', 'message_read', 'title_updated', 'dialog_deleted', 'photo_updated', 'dialog_mute_changed', 'dialog_mentioned_changed']);
        rangeIndex('user', ['uid', 'seq']).withStreaming();
        enableVersioning();
        enableTimestamps();
    });

    entity('UserMessagingState', () => {
        primaryKey('uid', 'number');
        field('seq', 'number');
        field('unread', 'number');
        rangeIndex('hasUnread', []).withCondition((src) => src.unread && src.unread > 0);
        enableVersioning();
        enableTimestamps();
    });

    entity('UserNotificationsState', () => {
        primaryKey('uid', 'number');
        field('readSeq', 'number').nullable();
        field('lastEmailNotification', 'number').nullable();
        field('lastPushNotification', 'number').nullable();
        field('lastEmailSeq', 'number').nullable();
        field('lastPushSeq', 'number').nullable();
        enableVersioning();
        enableTimestamps();
    });

    entity('HyperLog', () => {
        primaryKey('id', 'string');
        field('type', 'string');
        field('date', 'number');
        field('body', 'json');
        rangeIndex('created', ['createdAt']);
        rangeIndex('userEvents', ['createdAt']).withCondition((src) => src.type === 'track').withDisplayName('userEvents');
        rangeIndex('onlineChangeEvents', ['createdAt']).withCondition((src) => src.type === 'online_status').withDisplayName('onlineChangeEvents');
        enableTimestamps();
    });

    entity('MessageDraft', () => {
        primaryKey('uid', 'number');
        primaryKey('cid', 'number');
        field('contents', 'string').secure();
        enableVersioning();
        enableTimestamps();
    });

    entity('ChannelInvitation', () => {
        primaryKey('id', 'string');
        field('creatorId', 'number');
        field('channelId', 'number');
        field('email', 'string');
        field('firstName', 'string').nullable();
        field('lastName', 'string').nullable();
        field('text', 'string').nullable();
        field('acceptedById', 'number').nullable();
        field('enabled', 'boolean');
        rangeIndex('channel', ['createdAt', 'channelId']);
        rangeIndex('updated', ['updatedAt']);
        enableVersioning();
        enableTimestamps();
    });

    entity('ChannelLink', () => {
        primaryKey('id', 'string');
        field('creatorId', 'number');
        field('channelId', 'number');
        field('enabled', 'boolean');
        rangeIndex('channel', ['createdAt', 'channelId']);
        enableVersioning();
        enableTimestamps();
    });

    entity('AppInviteLink', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        uniqueIndex('user', ['uid']);
        enableVersioning();
        enableTimestamps();
    });

    entity('SampleEntity', () => {
        primaryKey('id', 'string');
        field('data', 'string');
        allowAdminEdit();
        enableVersioning();
        enableTimestamps();
    });

    entity('OrganizationPublicInviteLink', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('oid', 'number');
        field('enabled', 'boolean');
        uniqueIndex('userInOrganization', ['uid', 'oid']).withCondition(src => src.enabled);
        enableVersioning();
        enableTimestamps();
    });

    entity('OrganizationInviteLink', () => {
        primaryKey('id', 'string');
        field('oid', 'number');
        field('email', 'string');
        field('uid', 'number');
        field('firstName', 'string').nullable();
        field('lastName', 'string').nullable();
        field('text', 'string').nullable();
        field('ttl', 'number').nullable();
        field('enabled', 'boolean');
        field('joined', 'boolean');
        enumField('role', ['MEMBER', 'OWNER']);
        uniqueIndex('organization', ['oid', 'id']).withCondition(src => src.enabled);
        uniqueIndex('emailInOrganization', ['email', 'oid']).withCondition(src => src.enabled);
        enableVersioning();
        enableTimestamps();
    });

    entity('ConferenceRoom', () => {
        primaryKey('id', 'number');
        enableTimestamps();
        enableVersioning();
    });

    entity('ConferencePeer', () => {
        primaryKey('id', 'number');
        field('cid', 'number');
        field('uid', 'number');
        field('tid', 'string');
        field('keepAliveTimeout', 'number');
        field('enabled', 'boolean');
        uniqueIndex('auth', ['cid', 'uid', 'tid']).withCondition((src) => src.enabled);
        rangeIndex('conference', ['cid', 'keepAliveTimeout']).withCondition((src) => src.enabled);
        rangeIndex('active', ['keepAliveTimeout']).withCondition((src) => src.enabled);
        enableTimestamps();
        enableVersioning();
    });

    entity('ConferenceConnection', () => {
        primaryKey('peer1', 'number');
        primaryKey('peer2', 'number');
        field('cid', 'number');
        enumField('state', ['wait-offer', 'wait-answer', 'online', 'completed']);
        field('offer', 'string').nullable();
        field('answer', 'string').nullable();
        field('ice1', 'json');
        field('ice2', 'json');
        rangeIndex('conference', ['cid', 'createdAt']).withCondition((src) => src.state !== 'completed');
        enableTimestamps();
        enableVersioning();
    });

    //
    // Social Connections
    //

    entity('UserEdge', () => {
        primaryKey('uid1', 'number');
        primaryKey('uid2', 'number');
        rangeIndex('forward', ['uid1', 'uid2']);
        rangeIndex('reverse', ['uid2', 'uid1']);
        enableTimestamps();
        enableVersioning();
    });

    entity('UserInfluencerUserIndex', () => {
        primaryKey('uid', 'number');
        field('value', 'number');
        enableTimestamps();
        enableVersioning();
    });

    entity('UserInfluencerIndex', () => {
        primaryKey('uid', 'number');
        field('value', 'number');
        enableTimestamps();
        enableVersioning();
    });

    /* 
     * Feed
     */

    entity('FeedSubscriber', () => {
        primaryKey('id', 'number');
        field('key', 'string');
        enableTimestamps();
        enableVersioning();

        uniqueIndex('key', ['key']);
    });

    entity('FeedSubscription', () => {
        primaryKey('sid', 'number');
        primaryKey('tid', 'number');
        field('enabled', 'boolean');

        rangeIndex('subscriber', ['sid', 'tid']).withCondition((state) => state.enabled);
        rangeIndex('topic', ['tid', 'sid']).withCondition((state) => state.enabled);
    });

    entity('FeedTopic', () => {
        primaryKey('id', 'number');
        field('key', 'string');
        enableTimestamps();
        enableVersioning();

        uniqueIndex('key', ['key']);
    });
    entity('FeedEvent', () => {
        primaryKey('id', 'number');
        field('tid', 'number');

        field('type', 'string');
        field('content', 'json');

        enableTimestamps();
        enableVersioning();

        rangeIndex('topic', ['tid', 'createdAt']);
        rangeIndex('updated', ['updatedAt']);
    });

    entity('AppHook', () => {
        primaryKey('appId', 'number');
        primaryKey('chatId', 'number');
        field('key', 'string');
        uniqueIndex('key', ['key']);
        enableTimestamps();
        enableVersioning();
    });
});

generate(Schema, __dirname + '/../openland-module-db/schema.ts');