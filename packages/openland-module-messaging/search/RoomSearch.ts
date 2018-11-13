import { Modules } from 'openland-modules/Modules';
import { createTracer } from 'openland-log/createTracer';
import { withTracing } from 'openland-log/withTracing';

const tracer = createTracer('room-search');

export class RoomSearch {
    async searchForRooms(query: string, options: { uid: number, limit?: number }) {
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
        
        return await withTracing(tracer, 'search-dialog', async () => {
            let hits = await Modules.Search.elastic.client.search({
                index: 'dialog',
                type: 'dialog',
                size: options && options.limit ? options.limit : 20,
                body: { query: mainQuery }
            });
            let uids = hits.hits.hits.map((v) => parseInt(v._id, 10));
            return uids;
        });
    }
}