import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { encoders, inTx } from '@openland/foundationdb';
import { UserError } from '../../openland-errors/UserError';
import { Store } from '../../openland-module-db/FDB';
import { batch } from '../../openland-utils/batch';
import {
    addPhoneBookContactsImportWorker,
    createPhoneBookContactsImportWorker
} from '../workers/phonebookContactsImportWorker';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

export type PhonebookRecordInput = {
    firstName: string|null;
    lastName: string|null;
    info: string|null;
    phones: string[];
};

const phoneRegexp = /^\+[1-9]{1}[0-9]{3,14}$/;

export type PhoneRecord = { phone: string, firstName: string, lastName?: string };

@injectable()
export class PhonebookRepository {
    private importWorker = createPhoneBookContactsImportWorker();

    start = async () => {
        if (serverRoleEnabled('workers')) {
            addPhoneBookContactsImportWorker(this.importWorker);
        }
    }

    async addRecords(parent: Context, uid: number, records: PhonebookRecordInput[]) {
        return await inTx(parent, async ctx => {
            let profile = await Store.UserProfile.findById(ctx, uid);
            if (!profile) {
                throw new AccessDeniedError();
            }

            if (records.length > 100) {
                throw new UserError(`Can't save more than 100 records in one call`);
            }

            await Store.PhonebookUserImportedContacts.set(ctx, uid, true);

            let userToPhoneDirectory = this.getUserToPhoneDirectory();
            let phoneToUserDirectory = this.getPhoneToUserDirectory();

            let phonesToExport = records
                .filter(r => r.firstName)
                .map(r => r.phones.map(phone => ({ phone, firstName: r.firstName, lastName: r.lastName || undefined })))
                .flat()
                .filter(phone => phoneRegexp.test(phone.phone));

            // Save records
            await Promise.all(phonesToExport.map(async phone => {
                await userToPhoneDirectory.set(ctx, [uid, phone.phone], phone);
                await phoneToUserDirectory.set(ctx, [phone.phone, uid], phone);
            }));

            // Create tasks for import
            await Promise.all(batch(phonesToExport.map(p => p.phone), 30).map(async b => this.importWorker.pushWork(ctx, { uid, phones: b })));
        });
    }

    async getUserRecords(parent: Context, uid: number): Promise<PhoneRecord[]> {
        return await inTx(parent, async ctx => {
            return (await this.getUserToPhoneDirectory().range(ctx, [uid])).map(r => r.value);
        });
    }

    async getUsersImportedPhone(parent: Context, phone: string): Promise<number[]> {
        return await inTx(parent, async ctx => {
            return (await this.getPhoneToUserDirectory().range(ctx, [phone])).map(r => r.key[1] as number);
        });
    }

    private getUserToPhoneDirectory = () => Store.ImportedPhoneDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.json)

    private getPhoneToUserDirectory = () => Store.PhoneImportedByUserDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.json)
}
