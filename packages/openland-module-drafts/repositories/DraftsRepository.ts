import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';

export class DraftsRepository {

    findDraft = async (ctx: Context, uid: number, conversationId: number) => {
        let existing = await Store.MessageDraft.findById(ctx, uid, conversationId);
        if (existing && existing.contents !== '') {
            return existing.contents;
        } else {
            return null;
        }
    }

    saveDraft = async (parent: Context, uid: number, conversationId: number, message: string) => {
        await inTx(parent, async (ctx) => {
            let existing = await Store.MessageDraft.findById(ctx, uid, conversationId);
            if (existing) {
                existing.contents = message;
            } else {
                await Store.MessageDraft.create(ctx, uid, conversationId, { contents: message });
            }
        });
    }

    clearDraft = async (parent: Context, uid: number, conversationId: number) => {
        await inTx(parent, async (ctx) => {
            let existing = await Store.MessageDraft.findById(ctx, uid, conversationId);
            if (existing) {
                existing.contents = '';
            }
        });
    }
}