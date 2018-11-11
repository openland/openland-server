import { injectable } from 'inversify';
import { MessageInput } from 'openland-module-messaging/MessageInput';
import { MessagingRepository } from 'openland-module-messaging/repositories/MessagingRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { inTx } from 'foundation-orm/inTx';
import { DeliveryMediator } from './DeliveryMediator';
import { AllEntities } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { RoomRepository } from 'openland-module-messaging/repositories/RoomRepository';
import { AugmentationMediator } from './AugmentationMediator';

@injectable()
export class MessagingMediator {

    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('MessagingRepository')
    private readonly repo!: MessagingRepository;
    @lazyInject('DeliveryMediator')
    private readonly delivery!: DeliveryMediator;
    @lazyInject('AugmentationMediator')
    private readonly augmentation!: AugmentationMediator;
    @lazyInject('RoomRepository')
    private readonly room!: RoomRepository;

    sendMessage = async (uid: number, cid: number, message: MessageInput) => {
        return await inTx(async () => {

            // Check for bad words. Useful for debug.
            if (message.message === 'fuck') {
                throw Error('');
            }

            // Permissions
            await this.room.checkAccess(uid, cid);

            // Create
            let res = await this.repo.createMessage(cid, uid, message);

            // Delivery
            await this.delivery.onNewMessage((await this.entities.Message.findById(res.mid!))!);

            // Augment
            let message2 = (await this.entities.Message.findById(res.mid!))!;
            await this.augmentation.onMessageUpdated(message2);

            // Cancel typings
            // TODO: Remove
            let members = await this.room.findConversationMembers(cid);
            await Modules.Typings.cancelTyping(uid, cid, members);

            // Clear draft
            await Modules.Drafts.clearDraft(uid, cid);

            return res;
        });
    }

    editMessage = async (mid: number, uid: number, newMessage: MessageInput, markAsEdited: boolean) => {
        return await inTx(async () => {
            // TODO: Permissions

            // Update
            let res = await this.repo.editMessage(mid, newMessage, markAsEdited);
            let message = (await this.entities.Message.findById(res.mid!))!;

            // Delivery
            await this.delivery.onUpdateMessage(message);

            // Augment
            await this.augmentation.onMessageUpdated(message);

            return res;
        });
    }

    setReaction = async (mid: number, uid: number, reaction: string, reset: boolean = false) => {
        return await inTx(async () => {

            // Update
            let res = await this.repo.setReaction(mid, uid, reaction, reset);

            // Delivery
            let message = (await this.entities.Message.findById(res!.mid!))!;
            await this.delivery.onUpdateMessage(message);

            return res;
        });
    }

    deleteMessage = async (mid: number, uid: number) => {
        return await inTx(async () => {
            
            // Delete
            let res = await this.repo.deleteMessage(mid, uid);

            // Delivery
            let message = (await this.entities.Message.findById(res!.mid!))!;
            await this.delivery.onDeleteMessage(message);

            return res;
        });
    }

    readRoom = async (uid: number, cid: number, mid: number) => {
        return await inTx(async () => {
            let msg = await this.entities.Message.findById(mid);
            if (!msg || msg.cid !== cid) {
                throw Error('Invalid request');
            }
            await this.delivery.onRoomRead(uid, mid);
        });
    }

    //
    // Queries
    //

    findTopMessage = async (cid: number) => {
        return await this.repo.findTopMessage(cid);
    }
}