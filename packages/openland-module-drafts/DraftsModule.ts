import { DraftsMediator } from './mediators/DraftsMediator';
import { injectable } from 'inversify';
import { Context } from '@openland/context';

@injectable()
export class DraftsModule {
    private readonly repo = new DraftsMediator();

    findDraft = async (ctx: Context, uid: number, cid: number) => {
        return this.repo.findDraft(ctx, uid, cid);
    }

    setDraft = async (ctx: Context, uid: number, cid: number, message: string | null) => {
        return this.repo.setDraft(ctx, uid, cid, message);
    }

    start = async () => {
        // Nothing to do
    }
}