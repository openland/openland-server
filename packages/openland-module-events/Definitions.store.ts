// @ts-ignore
import { integer, field, string, optional, boolean, enumString, json, struct, array, union, event } from '@openland/foundationdb-compiler';

export function defineEvents() {
    event('UpdateChatRead', () => {
        field('uid', integer());
        field('cid', integer());
        field('seq', integer());
    });
    event('UpdateProfileChanged', () => {
        field('uid', integer());
    });
    event('UpdateChatAccessChanged', () => {
        field('uid', integer());
        field('cid', integer());
    });
    event('UpdateSettingsChanged', () => {
        field('uid', integer());
    });
    event('UpdateDialogListSettingsChanged', () => {
        field('uid', integer());
    });

    event('UpdateChatMessage', () => {
        field('uid', integer());
        field('cid', integer());
        field('mid', integer());
    });
    event('UpdateChatMessageUpdated', () => {
        field('uid', integer());
        field('cid', integer());
        field('mid', integer());
    });
    event('UpdateChatMessageDeleted', () => {
        field('uid', integer());
        field('cid', integer());
        field('mid', integer());
    });
    event('UpdateRoomChanged', () => {
        field('cid', integer());
    });

    event('UpdateChatDraftUpdated', () => {
        field('uid', integer());
        field('cid', integer());
        field('version', integer());
        field('date', integer());
        field('draft', optional(string()));
    });

    //
    // Feed
    //
    event('UpdateFeedItemReceived', () => {
        field('tid', integer());
        field('itemId', integer());
    });
    event('UpdateFeedItemUpdated', () => {
        field('tid', integer());
        field('itemId', integer());
    });
    event('UpdateFeedItemDeleted', () => {
        field('tid', integer());
        field('itemId', integer());
    });
}