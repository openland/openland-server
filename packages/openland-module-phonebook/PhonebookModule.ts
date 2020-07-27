import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { PhonebookRecordInput, PhonebookRepository, PhoneRecord } from './repositories/PhonebookRepository';
import { lazyInject } from '../openland-modules/Modules.container';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { inTx } from '@openland/foundationdb';
import {
    addPhonebookJoinMessagesWorker,
    createPhonebookJoinMessagesWorker
} from './workers/phonebookJoinMessagesWorker';

@injectable()
export class PhonebookModule {
    @lazyInject(PhonebookRepository)
    public readonly repo!: PhonebookRepository;

    private messagesWorker = createPhonebookJoinMessagesWorker();

    public start = async () => {
        await this.repo.start();

        if (serverRoleEnabled('workers')) {
            addPhonebookJoinMessagesWorker(this.messagesWorker);
        }
    }

    async addRecords(parent: Context, uid: number, records: PhonebookRecordInput[]) {
        return await this.repo.addRecords(parent, uid, records);
    }

    async onPhonePair(parent: Context, uid: number) {
        await inTx(parent, async ctx => {
            await this.messagesWorker.pushWork(ctx, { uid });
        });
    }

    async onNewUser(parent: Context, uid: number) {
        await inTx(parent, async ctx => {
            await this.messagesWorker.pushWork(ctx, { uid });
        });
    }

    async getUserRecords(parent: Context, uid: number): Promise<PhoneRecord[]> {
        return this.repo.getUserRecords(parent, uid);
    }

    async getUsersImportedPhone(parent: Context, phone: string): Promise<number[]> {
        return this.repo.getUsersImportedPhone(parent, phone);
    }
}
