import {
    array, atomicBool, customDirectory,
    entity,
    field,
    integer,
    optional,
    primaryKey,
    rangeIndex,
    string
} from '@openland/foundationdb-compiler';

export function phoneBookStore() {
    // Deprecated
    entity('PhonebookItem', () => {
        primaryKey('id', integer());
        field('uid', integer());
        field('firstName', string());
        field('lastName', optional(string()));
        field('info', optional(string()));
        field('phones', array(string()));
        rangeIndex('user', ['uid', 'id']);
        rangeIndex('updated', ['updatedAt']);
    });

    // [uid, phone] -> { firstName: string, lastName?: string, phone: string }
    customDirectory('ImportedPhone');
    // [phone, uid] -> { firstName: string, lastName?: string, phone: string }
    customDirectory('PhoneImportedByUser');

    atomicBool('PhonebookJoinMessageSentForPhone', () => {
        primaryKey('phone', string());
    });
    atomicBool('PhonebookUserImportedContacts', () => {
        primaryKey('uid', integer());
    });
}