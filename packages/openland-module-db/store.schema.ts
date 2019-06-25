import { declareSchema, atomicInt, primaryKey, atomicBool } from '@openland/foundationdb-compiler';

export default declareSchema(() => {
    atomicInt('UserCounter', () => {
        primaryKey('uid', 'number');
    });
    atomicInt('UserMessagesSentCounter', () => {
        primaryKey('uid', 'number');
    });
    atomicInt('UserMessagesSentInDirectChatCounter', () => {
        primaryKey('uid', 'number');
    });
    atomicInt('UserMessagesReceivedCounter', () => {
        primaryKey('uid', 'number');
    });
    atomicInt('UserMessagesChatsCounter', () => {
        primaryKey('uid', 'number');
    });
    atomicInt('UserMessagesDirectChatsCounter', () => {
        primaryKey('uid', 'number');
    });

    atomicInt('UserDialogCounter', () => {
        primaryKey('uid', 'number');
        primaryKey('cid', 'number');
    });
    atomicBool('UserDialogHaveMention', () => {
        primaryKey('uid', 'number');
        primaryKey('cid', 'number');
    });

    atomicInt('NotificationCenterCounter', () => {
        primaryKey('ncid', 'number');
    });
});