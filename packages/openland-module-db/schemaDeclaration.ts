import { generate } from '../foundation-orm-gen/generate';
import { declareSchema, entity, field, primaryKey, enableTimestamps, enableVersioning, enumField, rangeIndex, uniqueIndex, allowAdminEdit } from '../foundation-orm-gen';

const Schema = declareSchema(() => {
    entity('Online', () => {
        primaryKey('uid', 'number');
        field('lastSeen', 'number');
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
        uniqueIndex('salt', ['salt'])
            .withDisplayName('authTokenBySalt');
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
        enumField('status', ['pending', 'activated', 'suspended']);
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

    entity('Organization', () => {
        primaryKey('id', 'number');
        field('ownerId', 'number');
        enumField('status', ['pending', 'activated', 'suspended']);
        enumField('kind', ['organization', 'community']);
        field('editorial', 'boolean');
        enableTimestamps();
        enableVersioning();
    });

    entity('OrganizationProfile', () => {
        primaryKey('id', 'number');
        field('name', 'string');
        field('photo', 'json').nullable();
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

    entity('OrganizationMember', () => {
        primaryKey('id', 'number');
        field('uid', 'number');
        field('oid', 'number');
        enumField('role', ['admin', 'member']);
        uniqueIndex('organization', ['oid', 'uid'])
            .withRange();
        uniqueIndex('user', ['uid', 'oid'])
            .withRange();
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
        primaryKey('cid', 'number');
        enumField('kind', ['private', 'room']);

        // Private
        field('uid1', 'number').nullable();
        field('uid2', 'number').nullable();
        uniqueIndex('primate', ['uid1', 'uid2']).withCondition((src) => src.kind === 'private');

        // Room
        enumField('roomType', ['company', 'public', 'group']).nullable();
        field('roomOwner', 'number').nullable();
        field('membersCount', 'number');

        enableVersioning();
        enableTimestamps();
    });

    entity('RoomProfile', () => {
        primaryKey('cid', 'number');

        field('title', 'string');
        field('image', 'json');
        field('socialImage', 'json');
        field('description', 'string');
        field('longDescription', 'string');

        field('featured', 'boolean');
        field('hidden', 'boolean');

        enableVersioning();
        enableTimestamps();
    });

    entity('RoomParticipant', () => {
        primaryKey('cid', 'number');
        primaryKey('uid', 'number');
        field('invitedBy', 'number');
        enumField('role', ['member', 'admin', 'owner']);
        enumField('status', ['joined', 'requested', 'left', 'kicked']);
        uniqueIndex('active', ['cid', 'uid']).withCondition((src) => src.status === 'joined');
        uniqueIndex('requests', ['cid', 'uid']).withCondition((src) => src.status === 'requested');
        uniqueIndex('userActive', ['uid', 'cid']).withCondition((src) => src.status === 'joined');
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

        field('isMuted', 'boolean');
        field('isService', 'boolean');
        field('deleted', 'boolean').nullable();
        rangeIndex('chat', ['cid', 'id']).withCondition((src) => !src.deleted);
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
        rangeIndex('user', ['uid', 'date'])
            .withCondition((src) => !!src.date)
            .withDisplayName('dialogsForUser');
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
        enumField('kind', ['message_received', 'message_updated', 'message_deleted', 'message_read', 'title_updated']);
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
        uniqueIndex('email', ['email', 'id']).withCondition(src => src.enabled);
        uniqueIndex('emailInOrganization', ['email', 'oid']).withCondition(src => src.enabled);
        enableVersioning();
        enableTimestamps();
    });

});

generate(Schema, __dirname + '/../openland-module-db/schema.ts');