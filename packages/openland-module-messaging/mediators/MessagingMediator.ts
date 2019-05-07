import { injectable } from 'inversify';
import { LinkSpan, MessageInput, MessageSpan } from 'openland-module-messaging/MessageInput';
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
import { createTracer } from 'openland-log/createTracer';
import { UserError } from '../../openland-errors/UserError';
import { currentTime } from 'openland-utils/timer';
import { createLinkifyInstance } from '../../openland-utils/createLinkifyInstance';
import * as Chrono from 'chrono-node';

const trace = createTracer('messaging');
const linkifyInstance = createLinkifyInstance();

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
        return trace.trace(parent, 'sendMessage', async (ctx2) => await inTx(ctx2, async (ctx) => {
            if (message.message && message.message.trim().length === 0) {
                throw new UserError('Can\'t send empty message');
            }
            // Check for bad words. Useful for debug.
            if (message.message === 'fuck') {
                throw Error('');
            }

            // Permissions
            if (!skipAccessCheck) {
                await this.room.checkAccess(ctx, uid, cid);
                let conv = await this.entities.Conversation.findById(ctx, cid);
                if (conv && conv.archived) {
                    throw new AccessDeniedError();
                }
                if (conv && conv.kind === 'room' && !(await this.room.checkCanSendMessage(ctx, cid, uid))) {
                    throw new AccessDeniedError();
                }
            }

            let spans = message.spans ? [...message.spans] : [];
            //
            // Parse links
            //
            let links = this.parseLinks(message.message || '');
            if (links.length > 0) {
                spans.push(...links);
            }

            //
            // Parse dates
            //
            let dates = this.parseDates(message.message || '');
            if (dates.length > 0) {
                spans.push(...dates);
            }

            // Create
            let res = await this.repo.createMessage(ctx, cid, uid, { ...message, spans });

            // Delivery
            await this.delivery.onNewMessage(ctx, res.message);

            if (!message.ignoreAugmentation) {
                // Augment
                await this.augmentation.onNewMessage(ctx, res.message);
            }

            // Cancel typings
            // TODO: Remove
            let members = await this.room.findConversationMembers(ctx, cid);
            if (!message.isService && !message.isMuted) {
                await Modules.Typings.cancelTyping(uid, cid, members);
            }

            // Clear draft
            // TODO: Move
            await Modules.Drafts.clearDraft(ctx, uid, cid);

            return res.event;
        }));
    }

    bumpDialog = async (parent: Context, uid: number, cid: number) => {
        return trace.trace(parent, 'bumpDialog', async (ctx2) => await inTx(ctx2, async (ctx) => {
            await this.delivery.onDialogBump(ctx, uid, cid, currentTime());
        }));
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

            let spans: MessageSpan[] | null = null;

            if (newMessage.message) {
                spans = newMessage.spans ? [...newMessage.spans] : [];

                //
                // Parse links
                //
                let links = this.parseLinks(newMessage.message || '');
                if (links.length > 0) {
                    spans.push(...links);
                }

                //
                // Parse dates
                //
                let dates = this.parseDates(newMessage.message || '');
                if (dates.length > 0) {
                    spans.push(...dates);
                }
            }

            // Update
            let res = await this.repo.editMessage(ctx, mid, { ...newMessage, ... (spans ? { spans } : {}) }, markAsEdited);
            message = (await this.entities.Message.findById(ctx, mid!))!;

            // Delivery
            await this.delivery.onUpdateMessage(ctx, message);

            if (!newMessage.ignoreAugmentation) {
                // Augment
                await this.augmentation.onMessageUpdated(ctx, message);
            }

            return res;
        });
    }

    markMessageUpdated = async (parent: Context, mid: number) => {
        return await this.repo.markMessageUpdated(parent, mid);
    }

    setReaction = async (parent: Context, mid: number, uid: number, reaction: string, reset: boolean = false) => {
        return await inTx(parent, async (ctx) => {

            // Update
            let res = await this.repo.setReaction(ctx, mid, uid, reaction, reset);

            if (!res) {
                return;
            }

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

            let chatProfile = await this.entities.RoomProfile.findById(ctx, message.cid);
            if (chatProfile && chatProfile.pinnedMessage && chatProfile.pinnedMessage === message.id) {
                await this.room.unpinMessage(ctx, message.cid, uid);
            }

            return res;
        });
    }

    deleteMessages = async (parent: Context, mids: number[], uid: number) => {
        return await inTx(parent, async (ctx) => {
            for (let mid of mids) {
                await this.deleteMessage(ctx, mid, uid);
            }
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

    private parseLinks(message: string): MessageSpan[] {
        let urls = linkifyInstance.match(message);

        if (!urls) {
            return [];
        }

        let offsets = new Set<number>();

        function getOffset(str: string, n: number = 0): number {
            let offset = message.indexOf(str, n);

            if (offsets.has(offset)) {
                return getOffset(str, n + 1);
            }

            offsets.add(offset);
            return offset;
        }

        return urls.map(url => ({
            type: 'link',
            offset: getOffset(url.raw),
            length: url.raw.length,
            url: url.url,
        } as LinkSpan));
    }

    private parseDates(message: string): MessageSpan[] {
        let parsed = Chrono.parse(message, new Date());

        return parsed.map(part => {
            return {
                type: 'date_text',
                offset: part.index,
                length: part.text.length,
                date: part.start.date().getTime()
            };
        });
    }
}