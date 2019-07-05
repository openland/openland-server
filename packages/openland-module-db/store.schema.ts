import { declareSchema, atomicInt, primaryKey, atomicBool, integer, entity, field, string, optional, boolean, rangeIndex, uniqueIndex } from '@openland/foundationdb-compiler';

export default declareSchema(() => {

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
    // System
    //

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
});