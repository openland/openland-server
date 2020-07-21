import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { UserError } from '../../openland-errors/UserError';
import { Store } from '../../openland-module-db/FDB';
import { resolveSequenceNumber } from '../../openland-module-db/resolveSequenceNumber';

export type PhonebookRecordInput = {
    firstName: string;
    lastName: string|null;
    info: string|null;
    phones: string[];
};

const phoneRegexp = /^\+[1-9]{1}[0-9]{3,14}$/;

@injectable()
export class PhonebookRepository {
    async addRecords(parent: Context, uid: number, records: PhonebookRecordInput[]) {
        if (records.length > 500) {
            throw new UserError(`Can't save more than 500 records in one call`);
        }
        return await inTx(parent, async ctx => {
            await Store.PhonebookUserImportedContacts.set(ctx, uid, true);
            let storedRecords = await Store.PhonebookItem.user.findAll(ctx, uid);

            for (let record of records) {
                for (let phone of record.phones) {
                    if (!phoneRegexp.test(phone.trim())) {
                        throw new UserError('Invalid phone ' + phone);
                    }
                }

                let existing = storedRecords.find(r => (record.firstName + '' + (record.lastName || '')) === (r.firstName + '' + (r.lastName || '')));

                if (existing) {
                    existing.phones = record.phones;
                    existing.info = record.info;
                } else {
                    let id = await resolveSequenceNumber(ctx, 'phonebook-record');
                    await Store.PhonebookItem.create(ctx, id, {
                        uid,
                        firstName: record.firstName,
                        lastName: record.lastName,
                        phones: record.phones.map(p => p.trim()),
                        info: record.info
                    });
                }
            }
        });
    }
}
