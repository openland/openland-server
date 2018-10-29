import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';

export class UserSearch {
    async searchForUsers(query: string, options?: { uid?: number, limit?: number }) {
        let normalized = query.trim();
        if (normalized.length > 0) {

            let mainQuery: any = {
                bool: {
                    should: [
                        { match_phrase_prefix: { firstName: { query: query } } },
                        { match_phrase_prefix: { lastName: { query: query } } },
                        { match: { email: { query: query } } },
                    ],
                    must_not: options && options.uid ? [
                        { match: { _id: options.uid } }
                    ] : [],
                }
            };

            if (options && options.uid) {
                let profile = await FDB.UserProfile.findById(options.uid);
                if (profile && profile.primaryOrganization) {
                    mainQuery = {
                        function_score: {
                            query: mainQuery,
                            functions: [{
                                filter: { match: { primaryOrganization: profile.primaryOrganization } },
                                weight: 2
                            }],
                            boost_mode: 'multiply'
                        }
                    };
                }
            }

            let hits = await Modules.Search.elastic.client.search({
                index: 'user_profile',
                type: 'user_profile',
                size: options && options.limit ? options.limit : 20,
                body: { query: mainQuery }
            });
            let uids = hits.hits.hits.map((v) => parseInt(v._id, 10));
            return uids;
        } else {
            return [];
        }
    }
}