import { Context } from '@openland/context';
import { MessagesEventsRepository } from './../repositories/MessagesEventsRepository';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
// import { Modules } from 'openland-modules/Modules';
// import { Modules } from 'openland-modules/Modules';

@injectable()
export class EventsMediator {

    @lazyInject('MessagesEventsRepository')
    readonly messagingEvents!: MessagesEventsRepository;

    async onChatCreated(ctx: Context, cid: number) {
        // await Modules.Events.mediator.prepareChat(ctx, cid);
    }

    async onChatPrivateCreated(ctx: Context, cid: number, uid: number) {
        // await Modules.Events.mediator.preparePrivateChat(ctx, cid, uid);
    }

    async onChatJoined(ctx: Context, cid: number, uid: number) {
        // await Modules.Events.mediator.subscribe(ctx, uid, { type: 'chat', cid });
    }

    async onChatLeft(ctx: Context, cid: number, uid: number) {
        // await Modules.Events.mediator.unsubscribe(ctx, uid, { type: 'chat', cid });
    }

    async onMessageSent(ctx: Context, cid: number, mid: number, hiddenForUids: number[]) {
        this.messagingEvents.postMessageReceived(ctx, cid, mid, hiddenForUids);
    }

    async onMessageUpdated(ctx: Context, cid: number, mid: number, hiddenForUids: number[]) {
        this.messagingEvents.postMessageUpdated(ctx, cid, mid, hiddenForUids);
    }

    async onMessageDeleted(ctx: Context, cid: number, mid: number, hiddenForUids: number[]) {
        this.messagingEvents.postMessageDeleted(ctx, cid, mid, hiddenForUids);
    }
}