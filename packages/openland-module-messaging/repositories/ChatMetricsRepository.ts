import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { AllEntities } from 'openland-module-db/schema';
import { Context } from '@openland/context';

@injectable()
export class ChatMetricsRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    onMessageSent = async (ctx: Context, uid: number) => {
        (await this.entities.UserMessagesSentCounter.findById(ctx, uid)).increment(ctx);
    }

    onMessageReceived = async (ctx: Context, uid: number) => {
        (await this.entities.UserMessagesReceivedCounter.findById(ctx, uid)).increment(ctx);
    }

    onChatCreated = async (ctx: Context, uid: number) => {
        (await this.entities.UserMessagesChatsCounter.findById(ctx, uid)).increment(ctx);
    }

    onChatDeleted = async (ctx: Context, uid: number) => {
        (await this.entities.UserMessagesChatsCounter.findById(ctx, uid)).decrement(ctx);
    }

    onDirectChatCreated = async (ctx: Context, uid: number) => {
        (await this.entities.UserMessagesDirectChatsCounter.findById(ctx, uid)).increment(ctx);
    }
    
    onDirectChatDeleted = async (ctx: Context, uid: number) => {
        (await this.entities.UserMessagesDirectChatsCounter.findById(ctx, uid)).decrement(ctx);
    }
}