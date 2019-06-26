import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { DiscoverData } from './DiscoverData';
import { FDB } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { Modules } from 'openland-modules/Modules';

@injectable()
export class DiscoverModule {
    private data = new DiscoverData();

    nextPage = async (parent: Context, uid: number, selectedTags: string[], exludedGroups: string[]) => {
        return inTx(parent, async (ctx) => {
            let page = this.data.next(selectedTags, exludedGroups);
            if (page.chats) {
                // save picked tags if chats resolved
                // mark old as deleted
                let oldTags = await FDB.DiscoverUserPickedTags.allFromUser(ctx, uid);
                for (let old of oldTags) {
                    old.deleted = true;
                }
                // save new
                for (let tagId of selectedTags) {
                    let existing = await FDB.DiscoverUserPickedTags.findById(ctx, uid, tagId);
                    if (existing) {
                        existing.deleted = false;
                    } else {
                        await FDB.DiscoverUserPickedTags.create(ctx, uid, tagId, { deleted: false });
                    }
                }
                await Modules.Hooks.onDiscoverCompleted(ctx, uid);
            }
            return page;
        });
    }

    suggestedChats = async (parent: Context, uid: number) => {
        return inTx(parent, async (ctx) => {
            let selected = await FDB.DiscoverUserPickedTags.allFromUser(ctx, uid);
            return this.data.resolveSuggestedChats(selected.map(s => s.id));
        });

    }

    isDiscoverDone = async (parent: Context, uid: number) => {
        return inTx(parent, async (ctx) => {
            let selected = await FDB.DiscoverUserPickedTags.allFromUser(ctx, uid);
            return !!selected.length;
        });

    }
    reset = async (parent: Context, uid: number) => {
        return inTx(parent, async (ctx) => {
            let oldTags = await FDB.DiscoverUserPickedTags.allFromUser(ctx, uid);
            for (let old of oldTags) {
                old.deleted = true;
            }
            return true;
        });
    }
    start = () => {
        // Nothing to do
    }
}