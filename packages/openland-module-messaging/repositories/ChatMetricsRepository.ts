import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { AllEntities } from 'openland-module-db/schema';
import { Context } from '@openland/context';

@injectable()
export class ChatMetricsRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    onMessageSent = (ctx: Context, uid: number) => {
        this.entities.UserMessagesSentCounter.byId(uid).increment(ctx);
    }

    onMessageReceived = (ctx: Context, uid: number) => {
        this.entities.UserMessagesReceivedCounter.byId(uid).increment(ctx);
    }

    onChatCreated = (ctx: Context, uid: number) => {
        this.entities.UserMessagesChatsCounter.byId(uid).increment(ctx);
    }

    onChatDeleted = (ctx: Context, uid: number) => {
        this.entities.UserMessagesChatsCounter.byId(uid).decrement(ctx);
    }

    onDirectChatCreated = (ctx: Context, uid: number) => {
        this.entities.UserMessagesDirectChatsCounter.byId(uid).increment(ctx);
    }
    
    onDirectChatDeleted = (ctx: Context, uid: number) => {
        this.entities.UserMessagesDirectChatsCounter.byId(uid).decrement(ctx);
    }
}