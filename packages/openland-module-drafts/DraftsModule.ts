import { DraftsRepository } from './repositories/DraftsRepository';
import { FDB } from 'openland-module-db/FDB';
import { injectable } from 'inversify';
import { Context } from 'openland-utils/Context';

@injectable()
export class DraftsModule {
    private readonly repo = new DraftsRepository(FDB);

    findDraft = async (ctx: Context, uid: number, conversationId: number) => {
        return this.repo.findDraft(ctx, uid, conversationId);
    }

    saveDraft = async (ctx: Context, uid: number, conversationId: number, message: string) => {
        return this.repo.saveDraft(ctx, uid, conversationId, message);
    }

    clearDraft = async (ctx: Context, uid: number, conversationId: number) => {
        return this.repo.clearDraft(ctx, uid, conversationId);
    }

    start = () => {
        // Nothing to do
    }
}