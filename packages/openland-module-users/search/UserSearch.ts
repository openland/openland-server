import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { createTracer } from 'openland-log/createTracer';
import { Context } from 'openland-utils/Context';

const tracer = createTracer('user-search');
export class UserSearch {
    async searchForUsers(parent: Context, query: string, options?: { uid?: number, limit?: number, after?: string, page?: number, byName?: boolean }) {
        return await tracer.trace(parent, 'search', async (ctx) => {

            let normalized = query.trim();

            let mainQuery: any = {
                bool: {
                    should: normalized.length > 0 ? [
                        { match_phrase_prefix: options && options.byName ? { name: query } : { search: query } },
                    ] : [],
                    must_not: options && options.uid ? [
                        { match: { _id: options.uid } },
                        { match: { status: 'deleted' } },
                        { match: { status: 'suspended' } },
                        { match: { status: 'pending' } },
                    ] : [],
                }
            };

            if (options && options.uid) {
                let profilePromise = FDB.UserProfile.findById(ctx, options.uid);
                let organizationsPromise = Modules.Orgs.findUserOrganizations(ctx, options.uid);
                let profile = await profilePromise;
                let organizations = await organizationsPromise;
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

            return await tracer.trace(ctx, 'elastic', async () => {
                let hits = await Modules.Search.elastic.client.search({
                    index: 'user_profile',
                    type: 'user_profile',
                    size: options && options.limit ? options.limit : 20,
                    body: { query: mainQuery },
                    from: options && options.after ? parseInt(options.after, 10) : (options && options.page ? ((options.page - 1) * (options && options.limit ? options.limit : 20)) : 0),
                });
                let uids = hits.hits.hits.map((v) => parseInt(v._id, 10));
                return {
                    uids,
                    total: hits.hits.total,
                    hits
                };
            });
        });
    }
}