import { Store } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { createTracer } from 'openland-log/createTracer';
import { Context } from '@openland/context';
import { QueryParser } from '../../openland-utils/QueryParser';

const tracer = createTracer('room-search');

export class RoomSearch {
    async searchForRooms(ctx: Context, query: string, options: { uid: number, limit?: number }) {
        let normalized = query.trim();

        let mainQuery: any = {
            bool: {
                must: [
                    { match_phrase_prefix: { title: normalized } },
                    { term: { uid: options.uid } },
                    { term: { visible: true } }
                ]
            }
        };

        return await tracer.trace(ctx, 'search-dialog', async () => {
            let hits = await Modules.Search.search({
                index: 'dialog',
                type: 'dialog',
                size: options && options.limit ? options.limit : 20,
                body: { query: mainQuery }
            });
            let uids = hits.hits.hits.map((v) => parseInt((v._source as any).cid, 10));
            return uids;
        });
    }

    async globalSearchForRooms(ctx: Context, query: string, options: { first: number, after?: string, page?: number, sort?: string }) {
        let clauses: any[] = [];
        let sort: any[] | undefined = undefined;

        if (query || options.sort) {
            let parser = new QueryParser();
            parser.registerText('title', 'title');
            parser.registerBoolean('featured', 'featured');
            parser.registerText('createdAt', 'createdAt');
            parser.registerText('updatedAt', 'updatedAt');
            parser.registerText('membersCount', 'membersCount');

            if (query) {
                clauses.push({ match_phrase_prefix: { title: query } });
            } else {
                clauses.push({ term: { featured: true } });
            }

            if (options.sort) {
                sort = parser.parseSort(options.sort);
            }
        }

        clauses.push({ term: { listed: true} });

        let hits = await Modules.Search.search({
            index: 'room',
            type: 'room',
            size: options.first,
            from: options.after ? parseInt(options.after, 10) : (options.page ? ((options.page - 1) * options.first) : 0),
            body: {
                sort: sort,
                query: { bool: { must: clauses } }
            }
        });

        let ids = hits.hits.hits.map((v) => parseInt(v._id, 10));
        let rooms = await Promise.all(ids.map((v) => Store.Conversation.findById(ctx, v)));
        let offset = 0;
        if (options.after) {
            offset = parseInt(options.after, 10);
        } else if (options.page) {
            offset = (options.page - 1) * options.first;
        }
        let total = (hits.hits.total as any).value;

        return {
            edges: rooms.map((p, i) => {
                return {
                    node: p,
                    cursor: (i + 1 + offset).toString()
                };
            }),
            pageInfo: {
                hasNextPage: (total - (offset + 1)) >= options.first,
                hasPreviousPage: false,

                itemsCount: total,
                pagesCount: Math.min(Math.floor(8000 / options.first), Math.ceil(total / options.first)),
                currentPage: Math.floor(offset / options.first) + 1,
                openEnded: true
            },
        };
    }
}