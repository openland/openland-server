import { Context } from '@openland/context';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { CachedSubspace } from 'openland-module-db/CachedSubspace';
import { CountingCollection } from 'openland-module-db/collections/CountingCollection';
import { CountersMessageRef } from 'openland-module-db/structs';

const SUBSPACE_COUNTERS = 0;
const SUBSPACE_MAX_ID = 1;
const SUBSPACE_REFS = 2;

const COLLECTION_TOTAL = 0;
const COLLECTION_ALL_MENTION = 1;
const COLLECTION_MENTION = 2;
const COLLECTION_USER_TOTAL = 3;
const COLLECTION_USER_ALL_MENTION = 4;
const COLLECTION_PERSONAL_TOTAL = 5;

function filterDuplicates(src: number[]): number[] {
    let res: number[] = [];
    for (let s of src) {
        if (res.find((v) => v === s) !== undefined) {
            continue;
        }
        res.push(s);
    }
    return res;
}

export class CountersDirectory {
    private readonly subspace: Subspace;
    private readonly counting: CountingCollection;
    private readonly refs: CachedSubspace<CountersMessageRef>;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
        this.counting = new CountingCollection(subspace.subspace(encoders.tuple.pack([SUBSPACE_COUNTERS])));
        this.refs = new CachedSubspace(
            subspace.subspace(encoders.tuple.pack([SUBSPACE_REFS])),
            (src) => Buffer.from(CountersMessageRef.encode(src).finish()),
            (src) => CountersMessageRef.decode(src)
        );
    }

    async addOrUpdateMessage(ctx: Context, collection: TupleItem[], id: number, message: { mentions: number[], allMention: boolean, sender: number, visibleOnlyTo: number[] }) {

        //
        // Normalized input
        //
        // - Deduplicate visibleOnlyTo
        // - Remove sender from mention
        // - When allMentions -> mentions is empty
        // - When personal -> allMentions is empty
        //
        let sender = message.sender;
        let allMention: boolean;
        let mentions: number[];
        let visibleOnlyTo: number[] = filterDuplicates(message.visibleOnlyTo);
        if (visibleOnlyTo.length === 0) {
            allMention = message.allMention;
            mentions = message.allMention ? [] : message.mentions.filter((v) => v !== message.sender);
        } else {
            allMention = false;
            mentions = [];
            for (let u of message.visibleOnlyTo) {
                if (u === message.sender) {
                    continue;
                }
                if (allMention) {
                    mentions.push(u);
                } else if (message.mentions.find((v) => v === u) !== undefined) {
                    mentions.push(u);
                }
            }
        }

        // Update max known id
        await this.updateMaxId(ctx, collection, id);

        // Remove existing
        let old = await this.refs.read(ctx, [...collection, id]);
        if (old) {
            await this.removeMessage(ctx, collection, id);
        }
        this.refs.write(ctx, [...collection, id], new CountersMessageRef({
            sender,
            mentions,
            allMention,
            visibleOnlyTo
        }));

        //
        // Write global counters
        //

        if (visibleOnlyTo.length === 0) {
            await this.counting.add(ctx, [...collection, COLLECTION_TOTAL], id);
        }

        //
        // Write personal message counters
        //

        for (let u of visibleOnlyTo) {
            if (u !== sender) {
                await this.counting.add(ctx, [...collection, COLLECTION_PERSONAL_TOTAL, u], id);
            }
        }

        //
        // Write total all mention
        //

        if (allMention) {
            await this.counting.add(ctx, [...collection, COLLECTION_ALL_MENTION], id);
        }

        //
        // Write personal mentions
        //

        for (let m of mentions) {
            await this.counting.add(ctx, [...collection, COLLECTION_MENTION, m], id);
        }

        //
        // Write own sent total counter
        // 

        if (visibleOnlyTo.length === 0) {
            await this.counting.add(ctx, [...collection, COLLECTION_USER_TOTAL, sender], id);
        }

        //
        // Write own sent all mentions
        //

        if (allMention) {
            await this.counting.add(ctx, [...collection, COLLECTION_USER_ALL_MENTION, sender], id);
        }
    }

    async removeMessage(ctx: Context, collection: TupleItem[], id: number) {
        // Update max known id
        await this.updateMaxId(ctx, collection, id);

        // Remove message from index
        let old = await this.refs.read(ctx, [...collection, id]);
        if (!old) {
            return;
        }
        this.refs.write(ctx, [...collection, id], null);

        //
        // Remove global counter
        // 

        if (old.visibleOnlyTo.length === 0) {
            await this.counting.remove(ctx, [...collection, COLLECTION_TOTAL], id);
        }

        //
        // Remove personal message counters
        //

        for (let u of old.visibleOnlyTo) {
            if (u !== old.sender) {
                await this.counting.remove(ctx, [...collection, COLLECTION_PERSONAL_TOTAL, u], id);
            }
        }

        //
        // Write total all mention
        //

        if (old.allMention) {
            await this.counting.remove(ctx, [...collection, COLLECTION_ALL_MENTION], id);
        }

        //
        // Write personal mentions
        //

        for (let m of old.mentions) {
            await this.counting.remove(ctx, [...collection, COLLECTION_MENTION, m], id);
        }

        //
        // Write own sent total counter
        // 

        if (old.visibleOnlyTo.length === 0) {
            await this.counting.remove(ctx, [...collection, COLLECTION_USER_TOTAL, old.sender], id);
        }

        //
        // Write own sent all mentions
        //

        if (old.allMention) {
            await this.counting.remove(ctx, [...collection, COLLECTION_USER_ALL_MENTION, old.sender], id);
        }
    }

    async count(ctx: Context, collection: TupleItem[], uid: number, id: number) {
        let totalMessages = await this.counting.count(ctx, [...collection, COLLECTION_TOTAL], id);
        let allMentions = await this.counting.count(ctx, [...collection, COLLECTION_ALL_MENTION], id);

        let totalSent = await this.counting.count(ctx, [...collection, COLLECTION_USER_TOTAL, uid], id);
        let sentAllMentions = await this.counting.count(ctx, [...collection, COLLECTION_USER_ALL_MENTION, uid], id);

        let personalMentions = await this.counting.count(ctx, [...collection, COLLECTION_MENTION, uid], id);
        let personalMessages = await this.counting.count(ctx, [...collection, COLLECTION_PERSONAL_TOTAL, uid], id);

        return {
            unreadMentions: allMentions - sentAllMentions + personalMentions,
            unread: totalMessages - totalSent + personalMessages
        };
    }

    //
    // Tools
    //

    private async updateMaxId(ctx: Context, collection: TupleItem[], id: number) {
        let dst = encoders.tuple.pack([SUBSPACE_MAX_ID, ...collection]);
        let ex = await this.subspace.get(ctx, dst);
        if (ex) {
            let res = encoders.int32LE.unpack(ex);
            if (id > res) {
                this.subspace.set(ctx, dst, encoders.int32LE.pack(id));
            }
        } else {
            this.subspace.set(ctx, dst, encoders.int32LE.pack(id));
        }
    }
}