import { Store } from './../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { DiscoverData } from './DiscoverData';
import { Context } from '@openland/context';
import { Modules } from 'openland-modules/Modules';

@injectable()
export class DiscoverModule {
    private data = new DiscoverData();

    // deprecated
    nextPage = async (parent: Context, uid: number, selectedTags: string[], exludedGroups: string[]) => {
        return inTx(parent, async (ctx) => {
            let page = this.data.next(selectedTags, exludedGroups);
            if (page.chats) {
                // save picked tags if chats resolved
                // mark old as deleted
                let oldTags = await Store.DiscoverUserPickedTags.user.findAll(ctx, uid);
                for (let old of oldTags) {
                    old.deleted = true;
                }
                // save new
                for (let tagId of selectedTags) {
                    let existing = await Store.DiscoverUserPickedTags.findById(ctx, uid, tagId);
                    if (existing) {
                        existing.deleted = false;
                    } else {
                        await Store.DiscoverUserPickedTags.create(ctx, uid, tagId, { deleted: false });
                    }
                }
                page.chats = await this.sortChats(ctx, page.chats);
            }

            return page;
        });
    }

    gammaNextPage = async (parent: Context, uid: number, selectedTags: string[], exludedGroups: string[]) => {
        return inTx(parent, async () => {
            return this.data.next(selectedTags, exludedGroups);
        });
    }

    saveSelectedTags = async (parent: Context, uid: number, selectedTags: string[]) => {
        return inTx(parent, async (ctx) => {
            // save picked tags if chats resolved
            // mark old as deleted
            let oldTags = await Store.DiscoverUserPickedTags.user.findAll(ctx, uid);
            for (let old of oldTags) {
                old.deleted = true;
            }
            // save new
            for (let tagId of selectedTags) {
                let existing = await Store.DiscoverUserPickedTags.findById(ctx, uid, tagId);
                if (existing) {
                    existing.deleted = false;
                } else {
                    await Store.DiscoverUserPickedTags.create(ctx, uid, tagId, { deleted: false });
                }
            }
        });
    }

    submitNext = async (parent: Context, uid: number, selectedTags: string[], exludedGroups: string[]) => {
        return inTx(parent, async (ctx) => {
            let page = this.data.next(selectedTags, exludedGroups);
            if (page.chats) {
                await this.saveSelectedTags(ctx, uid, selectedTags);
                page.chats = await this.sortChats(ctx, page.chats);
            }
            return page;
        });
    }

    suggestedChats = async (parent: Context, uid: number) => {
        return inTx(parent, async (ctx) => {
            let selected = await Store.DiscoverUserPickedTags.user.findAll(ctx, uid);
            let chats = this.data.resolveSuggestedChats(selected.map(s => s.id));
            return await this.sortChats(ctx, chats);
        });
    }

    isDiscoverDone = async (parent: Context, uid: number) => {
        return inTx(parent, async (ctx) => {
            let selected = await Store.DiscoverUserPickedTags.user.findAll(ctx, uid);
            return !!selected.length;
        });

    }
    reset = async (parent: Context, uid: number) => {
        return inTx(parent, async (ctx) => {
            let oldTags = await Store.DiscoverUserPickedTags.user.findAll(ctx, uid);
            for (let old of oldTags) {
                old.deleted = true;
            }
            return true;
        });
    }
    skip = async (parent: Context, uid: number, selectedTags: string[]) => {
        return inTx(parent, async (ctx) => {
            let chats = this.data.resolveSuggestedChats(selectedTags);
            await this.saveSelectedTags(ctx, uid, selectedTags);
            await Modules.Hooks.onDiscoverSkipped(ctx, uid);
            chats = await this.sortChats(ctx, chats);
            return { chats };
        });
    }

    private sortChats = async (ctx: Context, chats: number[]): Promise<number[]> => {
        let chatRooms = await Promise.all(chats.map(a => Store.RoomProfile.findById(ctx, a)));
        let roomMembers = new Map<number, number>();
        for (let room of chatRooms) {
            if (!room) {
                continue;
            }
            roomMembers.set(room.id, room.activeMembersCount || 0);
        }
        let convs = await Promise.all(chats.map(c => Store.Conversation.findById(ctx, c)));
        let deletedChats = new Set<number>();
        convs.forEach(c => {
            if (c && c.deleted) {
                deletedChats.add(c.id);
            }
        });
        return chats.sort((a, b) => roomMembers.get(b)! - roomMembers.get(a)!).filter(c => !deletedChats.has(c));
    }

    start = () => {
        // Nothing to do
    }
}