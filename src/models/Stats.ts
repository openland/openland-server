import { CallContext } from './CallContext';
import { DB } from '../tables';
import { ElasticClient } from '../indexing/index';
import { cachedInt } from '../modules/cache';

export const Schema = `
    type GlobalStats {
        totalProjects: Int!
        totalDevelopers: Int!
        totalConstructors: Int!
        totalOrganizations: Int!
        totalPermits: Int!        
    }
    
    extend type Query {
        globalStats: GlobalStats!
    }

    extend type Area {
        stats: GlobalStats!
    }
`;

function resolve(id: number) {
    return {
        totalProjects: cachedInt(`projects_${id}`, async () => DB.BuidlingProject.count({ where: { account: id } })),
        totalDevelopers: cachedInt(`developers_${id}`, async () => DB.Developer.count({ where: { account: id, isDeveloper: true } })),
        totalConstructors: cachedInt(`constructors_${id}`, async () => DB.Developer.count({ where: { account: id, isConstructor: true } })),
        totalOrganizations: cachedInt(`organizations_${id}`, async () => DB.Developer.count({ where: { account: id } })),
        totalPermits: cachedInt(`permits_${id}`, async () => ElasticClient.count({
            index: 'permits', type: 'permit',
            body: {
                query: {
                    term: { 'account': id }
                }
            }
        }).then((v) => v.count)),
    };
}

export const Resolver = {
    Area: {
        stats: async function (context: { id: number }) {
            return resolve(context.id);
        }
    },
    Query: {
        globalStats: async function (_: any, args: {}, context: CallContext) {
            return resolve(context.accountId);
        }
    }
};