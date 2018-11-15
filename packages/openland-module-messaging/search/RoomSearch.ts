import { Modules } from 'openland-modules/Modules';
import { createTracer } from 'openland-log/createTracer';
import { Context } from 'openland-utils/Context';

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
            let hits = await Modules.Search.elastic.client.search({
                index: 'dialog',
                type: 'dialog',
                size: options && options.limit ? options.limit : 20,
                body: { query: mainQuery }
            });
            let uids = hits.hits.hits.map((v) => parseInt((v._source as any).cid, 10));
            return uids;
        });
    }
}