import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { createTracer } from 'openland-log/createTracer';
import { Context } from '@openland/context';

const tracer = createTracer('user-search');
// const log = createLogger('user-search');

type UserSearchQueryOptions = { uid?: number, byName?: boolean, uids?: number[], hashtags?: string[] };
type UserSearchOptions = UserSearchQueryOptions & { limit?: number, after?: string, page?: number };

export class UserSearch {
    async buildUsersQuery(ctx: Context, query: string, options?: UserSearchQueryOptions) {
        let normalized = query.trim();

        let shouldClauses = [];
        if (normalized.length > 0) {
            shouldClauses.push(
                {match_phrase_prefix: options && options.byName ? {name: query} : {search: query}},
                {match_phrase_prefix: {shortName: query}}
            );
        }
        if (options?.hashtags) {
            shouldClauses.push({match_phrase: {about: {query: options.hashtags.join(' '), boost: 0.7}}});
        }

        let mainQuery: any = {
            bool: {
                // activated AND (name match OR short_name match)
                must: [
                    {match: {status: 'activated'}},
                    {
                        bool: {
                            should: shouldClauses
                        }
                    }
                ]
            },
        };
        if (options && options.uids) {
            mainQuery.bool.must = [{terms: {userId: options.uids}}];
        }

        if (options && options.uid) {
            let profilePromise = Store.UserProfile.findById(ctx, options.uid);
            let organizationsPromise = Modules.Orgs.findUserOrganizations(ctx, options.uid);
            let topDialogs = await Store.UserEdge.forwardWeight.query(ctx, options.uid, {limit: 300, reverse: true});
            let profile = await profilePromise;
            let organizations = await organizationsPromise;
            let functions: any[] = [];

            // Huge boost if primary organization same
            if (profile && profile.primaryOrganization) {
                functions.push({
                    filter: {match: {primaryOrganization: profile.primaryOrganization}},
                    weight: 8
                });
            }

            // Boost if have common organizations (more common organizations - more boost)
            if (organizations.length > 0) {
                for (let o of organizations) {
                    functions.push({
                        filter: {match: {organizations: o}},
                        weight: 2
                    });
                }
            }

            // Boost top dialogs
            for (let dialog of topDialogs.items) {
                functions.push({
                    filter: {match: {userId: dialog.uid2}},
                    weight: dialog.weight || 1 // temporary hack for not breaking search when reindexing user edges
                });
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

        return mainQuery;
    }

    async searchForUsers(parent: Context, query: string, options?: UserSearchOptions) {
        return await tracer.trace(parent, 'search', async (ctx) => {
            let mainQuery = await this.buildUsersQuery(ctx, query, options);
            return await tracer.trace(ctx, 'elastic', async () => {
                let hits = await Modules.Search.search({
                    index: 'user_profile',
                    type: 'user_profile',
                    size: options && options.limit ? options.limit : 20,
                    body: {query: mainQuery, sort: ['_score']},
                    from: options && options.after ? parseInt(options.after, 10) : (options && options.page ? ((options.page - 1) * (options && options.limit ? options.limit : 20)) : 0),
                });
                let uids = hits.hits.hits.map((v) => parseInt(v._id, 10));
                return {
                    uids,
                    total: (hits.hits.total as any).value,
                    hits: hits.hits
                };
            });
        });
    }
}