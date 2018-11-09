import { DraftsRepository } from './repositories/DraftsRepository';
import { FDB } from 'openland-module-db/FDB';
import { injectable } from 'inversify';

@injectable()
export class DraftsModule {
    private readonly repo = new DraftsRepository(FDB);

    findDraft = async (uid: number, conversationId: number) => {
        return this.repo.findDraft(uid, conversationId);
    }

    saveDraft = async (uid: number, conversationId: number, message: string) => {
        return this.repo.saveDraft(uid, conversationId, message);
    }

    clearDraft = async (uid: number, conversationId: number) => {
        return this.repo.clearDraft(uid, conversationId);
    }

    start = () => {
        // Nothing to do
    }
}