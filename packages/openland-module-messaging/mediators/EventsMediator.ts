import { UserChatsActiveRepository } from './../repositories/UserChatsActiveRepository';
import { Context } from '@openland/context';
import { MessagesEventsRepository } from './../repositories/MessagesEventsRepository';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { Modules } from 'openland-modules/Modules';
import { UpdateChatMessage, UpdateChatMessageDeleted, UpdateChatMessageUpdated, UpdateChatRead } from 'openland-module-db/store';

@injectable()
export class EventsMediator {

    @lazyInject('MessagesEventsRepository')
    readonly messagingEvents!: MessagesEventsRepository;

    readonly userActiveChats = new UserChatsActiveRepository();

    async onChatCreated(ctx: Context, cid: number) {
        await Modules.Events.mediator.prepareChat(ctx, cid);
    }

    async onChatPrivateCreated(ctx: Context, cid: number, uid: number) {
        await Modules.Events.mediator.preparePrivateChat(ctx, cid, uid);
        // NOTE: Do not adding chat to active chats until first message
    }

    async onChatJoined(ctx: Context, cid: number, uid: number) {
        await Modules.Events.mediator.subscribe(ctx, uid, { type: 'chat', cid });
        this.userActiveChats.addChat(ctx, uid, cid);
    }

    async onChatLeft(ctx: Context, cid: number, uid: number) {
        await Modules.Events.mediator.unsubscribe(ctx, uid, { type: 'chat', cid });
        this.userActiveChats.removeChat(ctx, uid, cid);
    }

    //
    // Chart Read
    //

    async onChatRead(ctx: Context, cid: number, uid: number, seq: number) {
        await Modules.Events.postToCommon(ctx, uid, UpdateChatRead.create({ cid, seq, uid }));
    }

    //
    // Group Updates
    //

    async onGroupMessageSent(ctx: Context, cid: number, mid: number, uid: number, visibleOnlyForUids: number[]) {
        this.messagingEvents.postMessageReceived(ctx, cid, mid, visibleOnlyForUids);
        await Modules.Events.postToChat(ctx, cid, UpdateChatMessage.create({ cid, mid, uid }));
    }

    async onGroupMessageUpdated(ctx: Context, cid: number, mid: number, uid: number, visibleOnlyForUids: number[]) {
        this.messagingEvents.postMessageUpdated(ctx, cid, mid, visibleOnlyForUids);
        await Modules.Events.postToChat(ctx, cid, UpdateChatMessageUpdated.create({ cid, mid, uid }));
    }

    async onGroupMessageDeleted(ctx: Context, cid: number, mid: number, uid: number, visibleOnlyForUids: number[]) {
        this.messagingEvents.postMessageDeleted(ctx, cid, mid, visibleOnlyForUids);
        await Modules.Events.postToChat(ctx, cid, UpdateChatMessageDeleted.create({ cid, mid, uid }));
    }

    //
    // Private Updates
    //

    async onPrivateMessageSent(ctx: Context, cid: number, mid: number, uid: number, visibleOnlyForUids: number[], members: number[]) {
        this.messagingEvents.postMessageReceived(ctx, cid, mid, visibleOnlyForUids);

        let update = UpdateChatMessage.create({ cid, mid, uid });
        await Modules.Events.postToChat(ctx, cid, update);
        for (let m of members) {
            if (visibleOnlyForUids.length > 0 && !visibleOnlyForUids.find((u) => u === m)) {
                continue;
            }
            await Modules.Events.postToChatPrivate(ctx, cid, m, update);
            this.userActiveChats.addChat(ctx, m, cid);
        }
    }

    async onPrivateMessageUpdated(ctx: Context, cid: number, mid: number, uid: number, visibleOnlyForUids: number[], members: number[]) {
        this.messagingEvents.postMessageUpdated(ctx, cid, mid, visibleOnlyForUids);

        let update = UpdateChatMessageUpdated.create({ cid, mid, uid });
        await Modules.Events.postToChat(ctx, cid, update);
        for (let m of members) {
            if (visibleOnlyForUids.length > 0 && !visibleOnlyForUids.find((u) => u === m)) {
                continue;
            }
            await Modules.Events.postToChatPrivate(ctx, cid, m, update);
            this.userActiveChats.addChat(ctx, m, cid);
        }
    }

    async onPrivateMessageDeleted(ctx: Context, cid: number, mid: number, uid: number, visibleOnlyForUids: number[], members: number[]) {
        this.messagingEvents.postMessageDeleted(ctx, cid, mid, visibleOnlyForUids);

        let update = UpdateChatMessageDeleted.create({ cid, mid, uid });
        await Modules.Events.postToChat(ctx, cid, update);
        for (let m of members) {
            if (visibleOnlyForUids.length > 0 && !visibleOnlyForUids.find((u) => u === m)) {
                continue;
            }
            await Modules.Events.postToChatPrivate(ctx, cid, m, update);
            this.userActiveChats.addChat(ctx, m, cid);
        }
    }
}