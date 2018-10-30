import { generate } from '../foundation-orm-gen/generate';
import { declareSchema, entity, field, primaryKey, enableTimestamps, enableVersioning, enumField, rangeIndex, uniqueIndex } from '../foundation-orm-gen';

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

    entity('Counter', () => {
        primaryKey('name', 'string');
        field('value', 'number');
    });

    entity('AuthToken', () => {
        primaryKey('uuid', 'string');
        field('salt', 'string');
        field('uid', 'number');
        field('lastIp', 'string');
        uniqueIndex('salt', ['salt']);
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
            .withCondition((src) => src.taskStatus === 'pending');
        rangeIndex('executing', ['taskLockTimeout'])
            .withCondition((src) => src.taskStatus === 'executing');
        rangeIndex('failing', ['taskFailureTime'])
            .withCondition((src) => src.taskStatus === 'failing');

        enableTimestamps();
        enableVersioning();
    });

    entity('PushFirebase', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('tid', 'string');
        field('token', 'string');
        field('packageId', 'string');
        field('sandbox', 'boolean');
        field('enabled', 'boolean');
        field('failures', 'number').nullable();
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('token', ['token']).withCondition(src => src.enabled);
        enableTimestamps();
        enableVersioning();
    });

    entity('PushApple', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('tid', 'string');
        field('token', 'string');
        field('bundleId', 'string');
        field('sandbox', 'boolean');
        field('enabled', 'boolean');
        field('failures', 'number').nullable();
        rangeIndex('user', ['uid', 'id']);
        uniqueIndex('token', ['token']).withCondition(src => src.enabled);
        enableTimestamps();
        enableVersioning();
    });

    entity('PushWeb', () => {
        primaryKey('id', 'string');
        field('uid', 'number');
        field('tid', 'string');
        field('endpoint', 'string');
        field('enabled', 'boolean');
        field('failures', 'number').nullable();
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
        enumField('notificationsDelay', ['none', '1min', '15min']);
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
        field('code', 'string');
        field('expires', 'number');
        field('email', 'string');
        field('tokenId', 'string').nullable();
        field('enabled', 'boolean');
        enableVersioning();
        enableTimestamps();
    });

    //
    // Conversation
    //

    entity('ConversationMember', () => {
        primaryKey('cid', 'string');
        primaryKey('uid', 'number');
        field('enabled', 'boolean');
        uniqueIndex('conversationMembers', ['cid', 'uid']).withCondition((src) => src.enabled);
    });

    entity('ConversationSeq', () => {
        primaryKey('cid', 'string');
        field('seq', 'number');
    });

    //
    // Conversation State
    //

    entity('Message', () => {
        primaryKey('id', 'string');
        field('cid', 'string');
        field('uid', 'number');
        field('repeatToken', 'string').nullable();

        field('text', 'string').nullable();
        field('fileId', 'string').nullable();
        field('fileMetadata', 'json').nullable();
        field('filePreview', 'string').nullable();
        field('mentions', 'json').nullable();
        field('replyMessages', 'json').nullable();
        field('augmentation', 'json').nullable();

        field('isMuted', 'boolean');
        field('isService', 'boolean');
        field('deleted', 'boolean');
        rangeIndex('chat', ['cid', 'id']).withCondition((src) => !src.deleted);
        enableVersioning();
        enableTimestamps();
    });

    entity('ConversationEvent', () => {
        primaryKey('cid', 'string');
        primaryKey('seq', 'number');
        field('userId', 'number').nullable();
        field('kickedIds', 'json').nullable();
        field('addedIds', 'json').nullable();
        field('title', 'string').nullable();
        field('photo', 'string').nullable();
        field('messageId', 'string').nullable();
        enumField('kind', ['create_message', 'update_message', 'delete_message', 'group_update', 'add_members', 'remove_members']);
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
        rangeIndex('user', ['uid', 'date']).withCondition((src) => !!src.date);
        enableTimestamps();
        enableVersioning();
    });

    entity('UserMessagingState', () => {
        primaryKey('uid', 'number');
        field('seq', 'number');
        field('unread', 'number');
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

    entity('UserMessagingEvent', () => {
        primaryKey('uid', 'number');
        primaryKey('seq', 'number');
        field('allUnread', 'number');
        field('convUnread', 'number');
        field('userId', 'number').nullable();
        field('kickedIds', 'json').nullable();
        field('addedIds', 'json').nullable();
        field('title', 'string').nullable();
        field('photo', 'string').nullable();
        field('messageId', 'string').nullable();
        enumField('kind', ['create_message', 'update_message', 'delete_message', 'group_update', 'add_members', 'remove_members']);
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
        field('contents', 'string');
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
});

generate(Schema, __dirname + '/../openland-module-db/schema.ts');