import { Modules } from 'openland-modules/Modules';

export class UserSearch {
    async searchForUsers(query: string, options?: { uid?: number, limit?: number }) {
        let normalized = query.trim();
        if (normalized.length > 0) {
            let hits = await Modules.Search.elastic.client.search({
                index: 'user_profile',
                type: 'user_profile',
                size: options && options.limit ? options.limit : 20,
                body: {
                    query: {
                        bool: {
                            should: [
                                { match_phrase_prefix: { firstName: { query: query } } },
                                { match_phrase_prefix: { lastName: { query: query } } },
                                { match: { email: { query: query } } },
                            ]
                        }
                    }
                }
            });
            let uids = hits.hits.hits.map((v) => parseInt(v._id, 10));
            return uids;
        } else {
            return [];
        }
    }
}