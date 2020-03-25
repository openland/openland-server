import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { UserError } from '../../openland-errors/UserError';
import { Store } from '../../openland-module-db/FDB';
import { resolveSequenceNumber } from '../../openland-module-db/resolveSequenceNumber';

export type PhonebookRecordInput = {
    name: string;
    info: string|null;
    phone: string;
};

const phoneRegexp = /^\+[1-9]{1}[0-9]{3,14}$/;

@injectable()
export class PhonebookRepository {
    async addRecords(parent: Context, uid: number, records: PhonebookRecordInput[]) {
        if (records.length > 500) {
            throw new UserError(`Can't save more than 500 records in one call`);
        }
        return await inTx(parent, async ctx => {
            for (let record of records) {
                if (!phoneRegexp.test(record.phone.trim())) {
                    throw new UserError('Invalid phone ' + record.phone);
                }
                let id = await resolveSequenceNumber(ctx, 'phonebook-record');
                await Store.PhonebookItem.create(ctx, id, {
                    uid,
                    name: record.name,
                    phone: record.phone.trim(),
                    info: record.info
                });
            }
        });
    }
}
