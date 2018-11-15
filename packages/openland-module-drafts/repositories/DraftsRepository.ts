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

    saveDraft = async (parent: Context, uid: number, conversationId: number, message: string) => {
        await inTx(parent, async (ctx) => {
            let existing = await this.entities.MessageDraft.findById(ctx, uid, conversationId);
            if (existing) {
                existing.contents = message;
            } else {
                await this.entities.MessageDraft.create(ctx, uid, conversationId, { contents: message });
            }
        });
    }

    clearDraft = async (parent: Context, uid: number, conversationId: number) => {
        await inTx(parent, async (ctx) => {
            let existing = await this.entities.MessageDraft.findById(ctx, uid, conversationId);
            if (existing) {
                existing.contents = '';
            }
        });
    }
}