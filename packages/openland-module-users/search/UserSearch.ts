import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { Repos } from 'openland-server/repositories';

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
                let organizations = await Repos.Users.fetchUserAccounts(options.uid);
                let functions: any[] = [];

                // Huge boost if primary organization same
                if (profile && profile.primaryOrganization) {
                    functions.push({
                        filter: { match: { primaryOrganization: profile.primaryOrganization } },
                        weight: 8
                    });
                }

                // Boost if have common organizations (more common organizations - more boost)
                if (organizations.length > 0) {
                    for (let o of organizations) {
                        functions.push({
                            filter: { match: { organizations: o } },
                            weight: 2
                        });
                    }
                }
                
                if (functions.length > 0) {
                    mainQuery = {
                        function_score: {
                            query: mainQuery,
                            functions: functions,
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