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

export class HybridCountersRepository {
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

    async addOrUpdateMessage(ctx: Context, collection: TupleItem[], id: number, message: { mentions: number[], allMention: boolean, sender: number }) {

        // Normalized input
        let sender = message.sender;
        let allMention = message.allMention;
        let mentions = message.allMention ? [] : message.mentions.filter((v) => v !== message.sender);

        // Update max known id
        await this.updateMaxId(ctx, collection, id);

        // Resolve reference
        let old = await this.refs.read(ctx, [...collection, id]);
        this.refs.write(ctx, [...collection, id], new CountersMessageRef({
            sender,
            mentions,
            allMention
        }));

        if (old) {
            // NOTE: Not updating total counter

            // Update all mention counter
            if (old.allMention !== allMention) {
                if (allMention) {
                    await this.counting.add(ctx, [...collection, COLLECTION_ALL_MENTION], id);
                } else {
                    await this.counting.remove(ctx, [...collection, COLLECTION_ALL_MENTION], id);
                }
            }

            // Update personal mentions
            // 1. Add missing mentions
            for (let mention of mentions) {
                if (!old.mentions.find((v) => v === mention)) {
                    await this.counting.add(ctx, [...collection, COLLECTION_MENTION, mention], id);
                }
            }
            // 2. Remove removed mentions
            for (let mention of old.mentions) {
                if (!mentions.find((v) => v === mention)) {
                    await this.counting.remove(ctx, [...collection, COLLECTION_MENTION, mention], id);
                }
            }

            // NOTE: Not updating own sent total counter

            // Update sent all mention counter
            if (old.allMention !== allMention) {
                if (message.allMention) {
                    await this.counting.add(ctx, [...collection, COLLECTION_USER_ALL_MENTION, message.sender], id);
                } else {
                    await this.counting.remove(ctx, [...collection, COLLECTION_USER_ALL_MENTION, message.sender], id);
                }
            }
        } else {

            // Write total counter
            await this.counting.add(ctx, [...collection, COLLECTION_TOTAL], id);

            // Write total all mention
            if (allMention) {
                await this.counting.add(ctx, [...collection, COLLECTION_ALL_MENTION], id);
            }

            // Write personal mentions
            for (let m of mentions) {
                await this.counting.add(ctx, [...collection, COLLECTION_MENTION, m], id);
            }

            // Write own sent total counter
            await this.counting.add(ctx, [...collection, COLLECTION_USER_TOTAL, message.sender], id);

            // Write own sent all mentions
            if (allMention) {
                await this.counting.add(ctx, [...collection, COLLECTION_USER_ALL_MENTION, message.sender], id);
            }
        }
    }

    async removeMessage(ctx: Context, collection: TupleItem[], id: number) {
        // Update max known id
        await this.updateMaxId(ctx, collection, id);

        // Remove message from index
        let old = await this.refs.read(ctx, [...collection, id]);
        if (old) {
            this.refs.write(ctx, [...collection, id], null);
            await this.counting.remove(ctx, [...collection, COLLECTION_TOTAL], id);
            if (old.allMention) {
                await this.counting.remove(ctx, [...collection, COLLECTION_ALL_MENTION], id);
            }
            for (let m of old.mentions) {
                await this.counting.remove(ctx, [...collection, COLLECTION_MENTION, m], id);
            }
            await this.counting.remove(ctx, [...collection, COLLECTION_USER_TOTAL, old.sender], id);
            if (old.allMention) {
                await this.counting.remove(ctx, [...collection, COLLECTION_USER_ALL_MENTION, old.sender], id);
            }
        }
    }

    async count(ctx: Context, collection: TupleItem[], uid: number, id: number) {
        let totalUnread = await this.counting.count(ctx, [...collection, COLLECTION_TOTAL], id);
        let totalAllMentions = await this.counting.count(ctx, [...collection, COLLECTION_ALL_MENTION], id);
        let totalMentions = await this.counting.count(ctx, [...collection, COLLECTION_MENTION, uid], id);

        let localSent = await this.counting.count(ctx, [...collection, COLLECTION_USER_TOTAL, uid], id);
        let localAllMentions = await this.counting.count(ctx, [...collection, COLLECTION_USER_ALL_MENTION, uid], id);

        return {
            unreadMentions: totalAllMentions + totalMentions - localAllMentions,
            unread: totalUnread - localSent
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