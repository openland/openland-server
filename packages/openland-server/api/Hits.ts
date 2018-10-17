import { withUser } from './utils/Resolvers';
import { DB } from '../tables';

interface HitInput {
    category: string;
    tags: string[];
}

const POPULAR_RESPONSE_MAX = 20;

export const Resolver = {
    Query: {
        alphaHitsPopular: withUser<{ categories: string[] }>(async (args, uid) => {
            let hits: HitInput[] = [];

            for (let category of args.categories) {
                let topHits = await DB.Hit.findAll({
                    where: {
                        category,
                    },
                    order: [['hitsCount', 'DESC']],
                    limit: POPULAR_RESPONSE_MAX
                });

                if (topHits.length === 0) {
                    continue;
                }

                hits.push({
                    category,
                    tags: topHits.map(h => h.tag!)
                });
            }

            return hits;
        }),
    },

    Mutation: {
        alphaHitsAdd: withUser<{ hits: HitInput[] }>(async (args, uid) => {
            return DB.tx(async (tx) => {
                for (let hit of args.hits) {
                    for (let tag of hit.tags) {
                        let stored = await DB.Hit.findOne({
                            where: {
                                category: hit.category,
                                tag
                            },
                            transaction: tx
                        });

                        if (!stored) {
                            await DB.Hit.create(
                                {
                                    category: hit.category,
                                    tag,
                                    hitsCount: 1
                                },
                                { transaction: tx }
                            );
                        } else {
                            await stored.increment('hitsCount');
                        }
                    }
                }

                return 'ok';
            });
        }),
    }
};