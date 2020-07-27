import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { encoders, inTx } from '@openland/foundationdb';
import { UserError } from '../../openland-errors/UserError';
import { Store } from '../../openland-module-db/FDB';

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
        return await inTx(parent, async ctx => {
            if (records.length > 100) {
                throw new UserError(`Can't save more than 100 records in one call`);
            }

            await Store.PhonebookUserImportedContacts.set(ctx, uid, true);

            let directory = this.getDirectory();

            let phonesToExport = records
                .map(r => r.phones.map(phone => ({ phone, firstName: r.firstName, lastName: r.lastName || undefined })))
                .flat()
                .filter(phone => phoneRegexp.test(phone.phone));

            await Promise.all(phonesToExport.map(phone => directory.set(ctx, [uid, phone.phone], phone)));
        });
    }

    private getDirectory = () => Store.ImportedPhoneDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.json)
}
