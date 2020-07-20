import {
    allowDelete,
    entity,
    enumString, event,
    field,
    integer,
    primaryKey,
    rangeIndex
} from '@openland/foundationdb-compiler';
import { eventStore } from '@openland/foundationdb-compiler/lib/builder';

export function contactsStore() {
    entity('Contact', () => {
        primaryKey('uid', integer());
        primaryKey('contactUid', integer());
        field('state', enumString('active', 'deleted'));

        rangeIndex('user', ['uid', 'createdAt']).withCondition((item) => item.state === 'active');

        allowDelete();
    });

    event('ContactAddedEvent', () => {
        field('uid', integer());
        field('contactUid', integer());
    });

    event('ContactRemovedEvent', () => {
        field('uid', integer());
        field('contactUid', integer());
    });

    eventStore('UserContactsEventStore', () => {
        primaryKey('uid', integer());
    });
}