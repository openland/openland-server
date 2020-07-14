import { entity, enumString, field, integer, primaryKey, rangeIndex } from '@openland/foundationdb-compiler';

export function contactsStore() {
    entity('Contact', () => {
        primaryKey('uid', integer());
        primaryKey('contactUid', integer());
        field('state', enumString('active', 'deleted'));

        rangeIndex('user', ['uid', 'updatedAt']).withCondition((item) => item.state === 'active');
    });
}