import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { CountersRepository } from 'openland-module-messaging/repositories/CountersRepository';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { AllEntities } from 'openland-module-db/schema';
import { UserStateRepository } from 'openland-module-messaging/repositories/UserStateRepository';

@injectable()
export class CountersMediator {

    @lazyInject('CountersRepository')
    private readonly repo!: CountersRepository;
    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('UserStateRepository')
    private readonly userState!: UserStateRepository;

    onMessageReceived = async (uid: number, mid: number) => {
        return await inTx(async () => {
            let res = await this.repo.onMessageReceived(uid, mid);
            if (res !== 0) {
                let message = (await this.entities.Message.findById(mid));
                if (!message) {
                    throw Error('Unable to find message');
                }
                await this.deliverCounterPush(uid, message.cid);
            }
            return res;
        });
    }

    onMessageDeleted = async (uid: number, mid: number) => {
        return await inTx(async () => {
            let res = await this.repo.onMessageDeleted(uid, mid);
            if (res !== 0) {
                let message = (await this.entities.Message.findById(mid));
                if (!message) {
                    throw Error('Unable to find message');
                }
                await this.deliverCounterPush(uid, message.cid);
            }
            return res;
        });
    }

    onMessageRead = async (uid: number, mid: number) => {
        return await inTx(async () => {
            let res = await this.repo.onMessageRead(uid, mid);
            if (res !== 0) {
                let message = (await this.entities.Message.findById(mid));
                if (!message) {
                    throw Error('Unable to find message');
                }
                await this.deliverCounterPush(uid, message.cid);
            }
            return res;
        });
    }

    onDialogDeleted = async (uid: number, cid: number) => {
        return await inTx(async () => {
            let res = await this.repo.onDialogDeleted(uid, cid);
            if (res !== 0) {
                await this.deliverCounterPush(uid, cid);
            }
            return res;
        });
    }

    private deliverCounterPush = async (uid: number, cid: number) => {
        let global = await this.userState.getUserMessagingState(uid);
        await Modules.Push.sendCounterPush(uid, cid, global.unread);
    }
}