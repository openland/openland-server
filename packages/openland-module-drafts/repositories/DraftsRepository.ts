import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Context } from 'openland-utils/Context';

export class DraftsRepository {
    readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    findDraft = async (ctx: Context, uid: number, conversationId: number) => {
        let existing = await this.entities.MessageDraft.findById(ctx, uid, conversationId);
        if (existing && existing.contents !== '') {
            return existing.contents;
        } else {
            return null;
        }
    }

    saveDraft = async (ctx: Context, uid: number, conversationId: number, message: string) => {
        await inTx(async () => {
            let existing = await this.entities.MessageDraft.findById(ctx, uid, conversationId);
            if (existing) {
                existing.contents = message;
            } else {
                await this.entities.MessageDraft.create(ctx, uid, conversationId, { contents: message });
            }
        });
    }

    clearDraft = async (ctx: Context, uid: number, conversationId: number) => {
        await inTx(async () => {
            let existing = await this.entities.MessageDraft.findById(ctx, uid, conversationId);
            if (existing) {
                existing.contents = '';
            }
        });
    }
}