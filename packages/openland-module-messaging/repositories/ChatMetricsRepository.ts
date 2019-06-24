import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/store';

@injectable()
export class ChatMetricsRepository {
    
    @lazyInject('Store')
    private readonly store!: Store;

    onMessageSent = (ctx: Context, uid: number) => {
        this.store.UserMessagesSentCounter.byId(uid).increment(ctx);
    }

    onMessageReceived = (ctx: Context, uid: number) => {
        this.store.UserMessagesReceivedCounter.byId(uid).increment(ctx);
    }

    onChatCreated = (ctx: Context, uid: number) => {
        this.store.UserMessagesChatsCounter.byId(uid).increment(ctx);
    }

    onChatDeleted = (ctx: Context, uid: number) => {
        this.store.UserMessagesChatsCounter.byId(uid).decrement(ctx);
    }

    onDirectChatCreated = (ctx: Context, uid: number) => {
        this.store.UserMessagesDirectChatsCounter.byId(uid).increment(ctx);
    }
    
    onDirectChatDeleted = (ctx: Context, uid: number) => {
        this.store.UserMessagesDirectChatsCounter.byId(uid).decrement(ctx);
    }
}