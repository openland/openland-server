import { declareSchema, atomicInt, primaryKey, atomicBool, integer, entity, field, string } from '@openland/foundationdb-compiler';

export default declareSchema(() => {

    entity('Environment', () => {
        primaryKey('production', integer());
        field('comment', string());
        // allowAdminEdit();
    });

    entity('EnvironmentVariable', () => {
        primaryKey('name', string());
        field('value', string());
    });

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
});