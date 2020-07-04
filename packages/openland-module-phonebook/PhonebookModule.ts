import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { PhonebookRecordInput, PhonebookRepository } from './repositories/PhonebookRepository';
import { lazyInject } from '../openland-modules/Modules.container';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { phonebookIndexer } from './workers/phonebookIndexer';
// import {
//     addPhonebookJoinMessagesWorker,
//     createPhonebookJoinMessagesWorker
// } from './workers/phonebookJoinMessagesWorker';
import { inTx } from '@openland/foundationdb';

@injectable()
export class PhonebookModule {
    @lazyInject(PhonebookRepository)
    public readonly repo!: PhonebookRepository;

    // private messagesWorker = createPhonebookJoinMessagesWorker();

    public start = async () => {
        if (serverRoleEnabled('workers')) {
            phonebookIndexer();
        }
        if (serverRoleEnabled('workers')) {
            // addPhonebookJoinMessagesWorker(this.messagesWorker);
        }
    }

    async addRecords(parent: Context, uid: number, records: PhonebookRecordInput[]) {
        return await this.repo.addRecords(parent, uid, records);
    }

    async onPhonePair(parent: Context, uid: number) {
        await inTx(parent, async ctx => {
            // await this.messagesWorker.pushWork(ctx, { uid });
        });
    }

    async onNewUser(parent: Context, uid: number) {
        await inTx(parent, async ctx => {
            // await this.messagesWorker.pushWork(ctx, { uid });
        });
    }
}
