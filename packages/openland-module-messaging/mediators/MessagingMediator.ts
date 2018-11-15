import { injectable } from 'inversify';
import { MessageInput } from 'openland-module-messaging/MessageInput';
import { MessagingRepository } from 'openland-module-messaging/repositories/MessagingRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { inTx } from 'foundation-orm/inTx';
import { DeliveryMediator } from './DeliveryMediator';
import { AllEntities } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { AugmentationMediator } from './AugmentationMediator';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { RoomMediator } from './RoomMediator';
import { Context } from 'openland-utils/Context';

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
    @lazyInject('RoomMediator')
    private readonly room!: RoomMediator;

    sendMessage = async (parent: Context, uid: number, cid: number, message: MessageInput, skipAccessCheck?: boolean) => {
        return await inTx(parent, async (ctx) => {

            // Check for bad words. Useful for debug.
            if (message.message === 'fuck') {
                throw Error('');
            }

            // Permissions
            if (!skipAccessCheck) {
                await this.room.checkAccess(ctx, uid, cid);
            }

            // Create
            let res = await this.repo.createMessage(ctx, cid, uid, message);

            // Delivery
            await this.delivery.onNewMessage(ctx, res.message);

            // Augment
            await this.augmentation.onNewMessage(ctx, res.message);

            // Cancel typings
            // TODO: Remove
            let members = await this.room.findConversationMembers(ctx, cid);
            await Modules.Typings.cancelTyping(uid, cid, members);

            // Clear draft
            // TODO: Move
            await Modules.Drafts.clearDraft(ctx, uid, cid);

            return res.event;
        });
    }

    editMessage = async (parent: Context, mid: number, uid: number, newMessage: MessageInput, markAsEdited: boolean) => {
        return await inTx(parent, async (ctx) => {
            // Permissions
            let message = (await this.entities.Message.findById(ctx, mid!))!;
            if (message.uid !== uid) {
                if (await Modules.Super.superRole(ctx, uid) !== 'super-admin') {
                    throw new AccessDeniedError();
                }
            }

            // Update
            let res = await this.repo.editMessage(ctx, mid, newMessage, markAsEdited);
            message = (await this.entities.Message.findById(ctx, mid!))!;

            // Delivery
            await this.delivery.onUpdateMessage(ctx, message);

            // Augment
            await this.augmentation.onMessageUpdated(ctx, message);

            return res;
        });
    }

    setReaction = async (parent: Context, mid: number, uid: number, reaction: string, reset: boolean = false) => {
        return await inTx(parent, async (ctx) => {

            // Update
            let res = await this.repo.setReaction(ctx, mid, uid, reaction, reset);

            // Delivery
            let message = (await this.entities.Message.findById(ctx, res!.mid!))!;
            await this.delivery.onUpdateMessage(ctx, message);

            return res;
        });
    }

    deleteMessage = async (parent: Context, mid: number, uid: number) => {
        return await inTx(parent, async (ctx) => {

            let message = (await this.entities.Message.findById(ctx, mid!))!;
            if (message.uid !== uid) {
                if (await Modules.Super.superRole(ctx, uid) !== 'super-admin') {
                    throw new AccessDeniedError();
                }
            }

            // Delete
            let res = await this.repo.deleteMessage(ctx, mid);

            // Delivery
            message = (await this.entities.Message.findById(ctx, res!.mid!))!;
            await this.delivery.onDeleteMessage(ctx, message);

            return res;
        });
    }

    readRoom = async (parent: Context, uid: number, cid: number, mid: number) => {
        return await inTx(parent, async (ctx) => {
            let msg = await this.entities.Message.findById(ctx, mid);
            if (!msg || msg.cid !== cid) {
                throw Error('Invalid request');
            }
            await this.delivery.onRoomRead(ctx, uid, mid);
        });
    }

    //
    // Queries
    //

    findTopMessage = async (ctx: Context, cid: number) => {
        return await this.repo.findTopMessage(ctx, cid);
    }
}