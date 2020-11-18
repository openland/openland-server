import { Modules } from 'openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { UpdateChatDraftUpdated } from 'openland-module-db/store';

export class DraftsMediator {

    findDraft = async (ctx: Context, uid: number, cid: number) => {
        let existing = await Store.MessageDraft.findById(ctx, uid, cid);
        if (existing) {
            return {
                version: existing.metadata.versionCode,
                date: existing.metadata.updatedAt,
                value: (existing.contents && existing.contents !== '') ? existing.contents : null
            };
        }
        return null;
    }

    setDraft = async (parent: Context, uid: number, cid: number, message: string | null) => {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.MessageDraft.findById(ctx, uid, cid);
            if (existing) {
                if (existing.contents !== message) {
                    existing.contents = message;
                    await existing.flush(ctx);
                }
            } else {
                existing = await Store.MessageDraft.create(ctx, uid, cid, { contents: message });
            }
            let res = {
                version: existing.metadata.versionCode,
                date: existing.metadata.updatedAt,
                value: (existing.contents && existing.contents !== '') ? existing.contents : null
            };

            // Post event
            await Modules.Events.postToCommon(ctx, uid, UpdateChatDraftUpdated.create({
                uid,
                cid,
                version: res.version,
                date: res.date,
                draft: res.value
            }));

            return res;
        });
    }
}