import { customDirectory, event, field, integer, primaryKey } from '@openland/foundationdb-compiler';
import { eventStore } from '@openland/foundationdb-compiler/lib/builder';

export function blackListStore() {
    // [uid, bannedUid] -> true
    customDirectory('BlackListDirectory');

    event('BlackListAddedEvent', () => {
        field('bannedBy', integer());
        field('bannedUid', integer());
    });

    event('BlackListRemovedEvent', () => {
        field('bannedBy', integer());
        field('bannedUid', integer());
    });

    eventStore('BlackListEventStore', () => {
        primaryKey('uid', integer());
    });
}