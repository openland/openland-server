import { inTx } from 'foundation-orm/inTx';
import { AllEntities } from 'openland-module-db/schema';
import { injectable } from 'inversify';
import { UserStateRepository } from './UserStateRepository';
import { lazyInject } from 'openland-modules/Modules.container';

@injectable()
export class CountersRepository {

    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('UserStateRepository')
    private readonly userState!: UserStateRepository;

    onMessageReceived = async (uid: number, mid: number) => {
        return await inTx(async () => {
            let message = (await this.entities.Message.findById(mid));
            if (!message) {
                throw Error('Unable to find message');
            }

            // Ignore already deleted messages
            if (message.deleted) {
                return 0;
            }

            // Ignore own messages
            if (message.uid === uid) {
                return 0;
            }

            // Avoid double counter for same message
            if (await this.entities.UserDialogHandledMessage.findById(uid, message.cid, mid)) {
                return 0;
            }
            this.entities.UserDialogHandledMessage.create(uid, message.cid, mid, {});

            // Updating counters if not read already
            let local = await this.userState.getUserDialogState(uid, message.cid);
            let global = await this.userState.getUserMessagingState(uid);
            if (!local.readMessageId || mid > local.readMessageId) {
                local.unread++;
                global.unread++;
                await global.flush();
                await local.flush();
                return 1;
            }
            return 0;
        });
    }

    onMessageDeleted = async (uid: number, mid: number) => {
        return await inTx(async () => {
            let message = (await this.entities.Message.findById(mid));
            if (!message) {
                throw Error('Unable to find message');
            }

            // Updating counters if not read already
            let local = await this.userState.getUserDialogState(uid, message.cid);
            let global = await this.userState.getUserMessagingState(uid);
            if (message.uid !== uid && (!local.readMessageId || mid < local.readMessageId)) {
                local.unread--;
                global.unread--;
                await global.flush();
                await local.flush();
                return -1;
            }
            return 0;
        });
    }

    onMessageRead = async (uid: number, mid: number) => {
        return await inTx(async () => {
            let message = (await this.entities.Message.findById(mid));
            if (!message) {
                throw Error('Unable to find message');
            }
            let local = await this.userState.getUserDialogState(uid, message.cid);
            let global = await this.userState.getUserMessagingState(uid);
            if (!local.readMessageId || local.readMessageId < mid) {
                local.readMessageId = mid;

                // Find all remaining messages
                let remaining = (await this.entities.Message.allFromChatAfter(message.cid, mid)).filter((v) => v.uid !== uid && v.id !== mid).length;
                let delta: number;
                if (remaining === 0) { // Just additional case for self-healing of a broken counters
                    delta = -local.unread;
                } else {
                    delta = - (remaining - local.unread);
                }
                // Crazy hack to avoid -0 values
                if (delta === 0) {
                    delta = 0;
                }

                // Update counters
                if (delta !== 0) {
                    local.unread += delta;
                    global.unread += delta;
                }
                await global.flush();
                await local.flush();
                return delta;
            }
            return 0;
        });
    }

    onDialogDeleted = async (uid: number, cid: number) => {
        return await inTx(async () => {
            let local = await this.userState.getUserDialogState(uid, cid);
            let global = await this.userState.getUserMessagingState(uid);
            if (local.unread > 0) {
                let delta = -local.unread;
                global.unread += delta;
                local.unread = 0;
                await global.flush();
                await local.flush();
                return delta;
            }
            return 0;
        });
    }
}